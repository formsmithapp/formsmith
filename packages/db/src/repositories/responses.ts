// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { and, desc, eq, lt, or, sql } from 'drizzle-orm'
import type { Database } from '../client'
import { forms, formUsage, responses } from '../schema'

/** Thrown inside the metered-insert transaction to roll it back on over-cap. */
class OverCapError extends Error {}

/**
 * Responses persistence. `insert` is UNSCOPED (the public submit path has no
 * workspace — the S2 service layer resolves and re-evaluates first); all
 * dashboard reads/deletes are workspace-scoped through the forms join.
 */

export interface ResponseRow {
  id: string
  formId: string
  formVersion: number
  answers: Record<string, unknown>
  variables: Record<string, unknown>
  hidden: Record<string, string>
  ending: string | null
  aiTrace: unknown[] | null
  submittedAt: Date
}

export interface NewResponse {
  formId: string
  formVersion: number
  answers: Record<string, unknown>
  variables: Record<string, unknown>
  hidden: Record<string, string>
  ending: string | null
  aiTrace?: unknown[] | null
}

export interface ListOptions {
  /** Opaque keyset cursor from a previous page's `nextCursor`. */
  cursor?: string
  /** Page size; clamped to [1, MAX_LIMIT], default DEFAULT_LIMIT. */
  limit?: number
}

export interface ResponsePage {
  responses: ResponseRow[]
  /** Feed back as `cursor` for the next page, or null when the list is exhausted. */
  nextCursor: string | null
}

export const DEFAULT_LIMIT = 50
export const MAX_LIMIT = 200

/** Keyset order is (submittedAt desc, id desc); the cursor pins both halves. */
const encodeCursor = (row: { submittedAt: Date; id: string }): string =>
  Buffer.from(`${row.submittedAt.toISOString()}|${row.id}`).toString('base64url')

function decodeCursor(cursor: string): { submittedAt: Date; id: string } | null {
  let raw: string
  try {
    raw = Buffer.from(cursor, 'base64url').toString('utf8')
  } catch {
    return null
  }
  const sep = raw.lastIndexOf('|')
  if (sep === -1) return null
  const submittedAt = new Date(raw.slice(0, sep))
  const id = raw.slice(sep + 1)
  if (Number.isNaN(submittedAt.getTime()) || id === '') return null
  return { submittedAt, id }
}

const clampLimit = (limit: number | undefined): number =>
  Math.min(Math.max(1, Math.trunc(limit ?? DEFAULT_LIMIT)), MAX_LIMIT)

export function responsesRepository(db: Database) {
  const scopedForm = (workspaceId: string, formId: string) =>
    and(eq(forms.workspaceId, workspaceId), eq(forms.id, formId))

  return {
    async insert(data: NewResponse): Promise<ResponseRow> {
      const [row] = await db.insert(responses).values(data).returning()
      if (row === undefined) throw new Error('response insert returned nothing')
      return row
    },

    /**
     * Insert a response while enforcing a monthly cap. Upsert-increments the
     * `(formId, month)` bucket and stores the response in ONE transaction: if
     * the increment crosses `monthlyCap`, the transaction rolls back (nothing
     * stored, the counter is not advanced) and `{ ok: false }` is returned.
     * `monthlyCap === null` means unlimited (a plain insert, no bucket touched).
     */
    async insertMetered(
      data: NewResponse,
      opts: { monthlyCap: number | null; month: string },
    ): Promise<{ ok: true; row: ResponseRow } | { ok: false; reason: 'over_cap' }> {
      const cap = opts.monthlyCap
      if (cap === null) return { ok: true, row: await this.insert(data) }
      try {
        const row = await db.transaction(async (tx) => {
          const [usage] = await tx
            .insert(formUsage)
            .values({ formId: data.formId, month: opts.month, responses: 1 })
            .onConflictDoUpdate({
              target: [formUsage.formId, formUsage.month],
              set: { responses: sql`${formUsage.responses} + 1` },
            })
            .returning({ responses: formUsage.responses })
          if (usage !== undefined && usage.responses > cap) throw new OverCapError()
          const [inserted] = await tx.insert(responses).values(data).returning()
          if (inserted === undefined) throw new Error('response insert returned nothing')
          return inserted
        })
        return { ok: true, row }
      } catch (error) {
        if (error instanceof OverCapError) return { ok: false, reason: 'over_cap' }
        throw error
      }
    },

    /**
     * One keyset page, newest first. The tie-break on `id` makes the order a
     * total order so pages never overlap or drop rows when timestamps collide.
     * Served by `responses_form_submitted_idx` (formId, submittedAt desc).
     */
    async list(
      workspaceId: string,
      formId: string,
      options: ListOptions = {},
    ): Promise<ResponsePage> {
      const limit = clampLimit(options.limit)
      const after = options.cursor !== undefined ? decodeCursor(options.cursor) : null

      // (submittedAt, id) < (cursor) under the desc ordering.
      const keyset =
        after !== null
          ? or(
              lt(responses.submittedAt, after.submittedAt),
              and(eq(responses.submittedAt, after.submittedAt), lt(responses.id, after.id)),
            )
          : undefined

      const rows = await db
        .select({ response: responses })
        .from(responses)
        .innerJoin(forms, eq(responses.formId, forms.id))
        .where(and(scopedForm(workspaceId, formId), keyset))
        .orderBy(desc(responses.submittedAt), desc(responses.id))
        .limit(limit + 1)

      const page = rows.slice(0, limit).map((row) => row.response)
      const last = page[page.length - 1]
      const nextCursor = rows.length > limit && last !== undefined ? encodeCursor(last) : null
      return { responses: page, nextCursor }
    },

    /**
     * Cursor-walks the whole (workspace-scoped) response set in newest-first
     * batches for streaming export + server-side summary folds. Bounded memory:
     * one batch is resident at a time, never the full table.
     */
    async *walk(
      workspaceId: string,
      formId: string,
      batchSize = MAX_LIMIT,
    ): AsyncGenerator<ResponseRow[]> {
      let cursor: string | undefined
      do {
        const page = await this.list(workspaceId, formId, { cursor, limit: batchSize })
        if (page.responses.length > 0) yield page.responses
        cursor = page.nextCursor ?? undefined
      } while (cursor !== undefined)
    },

    async get(
      workspaceId: string,
      formId: string,
      responseId: string,
    ): Promise<ResponseRow | null> {
      const rows = await db
        .select({ response: responses })
        .from(responses)
        .innerJoin(forms, eq(responses.formId, forms.id))
        .where(and(scopedForm(workspaceId, formId), eq(responses.id, responseId)))
        .limit(1)
      return rows[0]?.response ?? null
    },

    async remove(workspaceId: string, formId: string, responseId: string): Promise<boolean> {
      const owned = await this.get(workspaceId, formId, responseId)
      if (owned === null) return false
      const rows = await db
        .delete(responses)
        .where(and(eq(responses.id, responseId), eq(responses.formId, formId)))
        .returning({ id: responses.id })
      return rows.length > 0
    },
  }
}

export type ResponsesDbRepository = ReturnType<typeof responsesRepository>
