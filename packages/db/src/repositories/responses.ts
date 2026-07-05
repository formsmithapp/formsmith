// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { and, desc, eq } from 'drizzle-orm'
import type { Database } from '../client'
import { forms, responses } from '../schema'

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

export function responsesRepository(db: Database) {
  const scopedForm = (workspaceId: string, formId: string) =>
    and(eq(forms.workspaceId, workspaceId), eq(forms.id, formId))

  return {
    async insert(data: NewResponse): Promise<ResponseRow> {
      const [row] = await db.insert(responses).values(data).returning()
      if (row === undefined) throw new Error('response insert returned nothing')
      return row
    },

    async list(workspaceId: string, formId: string): Promise<ResponseRow[]> {
      const rows = await db
        .select({ response: responses })
        .from(responses)
        .innerJoin(forms, eq(responses.formId, forms.id))
        .where(scopedForm(workspaceId, formId))
        .orderBy(desc(responses.submittedAt))
      return rows.map((row) => row.response)
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
