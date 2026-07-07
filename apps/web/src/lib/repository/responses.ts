// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  evaluateSubmission,
  type QuestionSummary,
  type SubmissionIssue,
  summarize,
} from '@formsmithapp/engine'
import type { StorageLike } from './local'
import type { FormsRepository } from './types'

/**
 * The responses persistence boundary — same seam discipline as
 * `FormsRepository` (async everywhere; the api/db slice swaps the class).
 *
 * `add()` is deliberately the server's job done locally: it re-evaluates the
 * untrusted payload against the PINNED published snapshot via the engine's
 * `evaluateSubmission` (v1 §12 #6), stores the canonical answers and the
 * authoritative recomputed variables, and rejects tampered/invalid payloads.
 * Client-sent variables are only ever cross-checked — never stored.
 */

export interface ResponsePayload {
  formId: string
  formVersion?: number
  answers: Record<string, unknown>
  variables?: Record<string, unknown>
  hiddenFields?: Record<string, string>
  /** Signed AI exchange tuples from the runtime — the server verifies each sig. */
  aiExchanges?: AiExchangePayload[]
  /** Honeypot — forwarded verbatim; the server accepts-and-discards when set. */
  _hp?: string
}

/** The wire shape of one signed exchange (issued by POST /f/:id/ai). */
export interface AiExchangePayload {
  ref: string
  index: number
  question: string
  meta: Record<string, unknown>
  sig: string
  answer: string
}

export interface StoredResponse {
  id: string
  formId: string
  /** The published snapshot this response was collected under. */
  formVersion: number
  submittedAt: string
  /** Canonical accepted answers — path-walked, validated. */
  answers: Record<string, unknown>
  /** Authoritative recomputed variables (never the client's). */
  variables: Record<string, unknown>
  hidden: Record<string, string>
  /** Ref of the ending block the path reached, or null. */
  ending: string | null
  /** Server-verified AI exchange transcript (S4). */
  aiTrace?: AiTraceEntry[] | null
}

export interface AiTraceEntry {
  ref: string
  index: number
  question: string
  answer: string
  fallback?: boolean
  type?: string
  engagement?: number
  model?: string | null
  latencyMs?: number
  reason?: string
  verified?: boolean
}

export class SubmissionRejectedError extends Error {
  readonly issues: readonly SubmissionIssue[]

  constructor(issues: readonly SubmissionIssue[]) {
    super(`Submission rejected: ${issues.map((issue) => issue.code).join(', ')}`)
    this.name = 'SubmissionRejectedError'
    this.issues = issues
  }
}

export interface ListOptions {
  /** Opaque keyset cursor from a previous page's `nextCursor`. */
  cursor?: string
  /** Page size; server clamps to [1, 200], default 50. */
  limit?: number
}

export interface ResponsePage {
  responses: StoredResponse[]
  /** Feed back as `cursor` for the next page, or null when exhausted. */
  nextCursor: string | null
}

/** Per-question summary + total response count, computed server-side. */
export interface ResponseSummary {
  total: number
  summary: QuestionSummary[]
}

export interface ResponsesRepository {
  /** Re-evaluates against the pinned snapshot; stores; rejects invalid. */
  add(payload: ResponsePayload): Promise<StoredResponse>
  /** One keyset page, newest first. */
  list(formId: string, options?: ListOptions): Promise<ResponsePage>
  /** Aggregate summary over the latest published snapshot. */
  summary(formId: string): Promise<ResponseSummary>
  get(formId: string, responseId: string): Promise<StoredResponse | null>
  remove(formId: string, responseId: string): Promise<void>
  clear(formId: string): Promise<void>
}

const responsesKey = (formId: string) => `fs.responses.${formId}`

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const clampLimit = (limit: number | undefined): number =>
  Math.min(Math.max(1, Math.trunc(limit ?? DEFAULT_LIMIT)), MAX_LIMIT)

/** Opaque local cursor. Never crosses to the server, so any stable encoding works. */
const encodeCursor = (response: StoredResponse): string =>
  btoa(`${response.submittedAt}|${response.id}`)

export class LocalStorageResponsesRepository implements ResponsesRepository {
  constructor(
    private readonly storage: StorageLike,
    private readonly forms: FormsRepository,
  ) {}

  private read(formId: string): StoredResponse[] {
    const raw = this.storage.getItem(responsesKey(formId))
    if (raw === null) return []
    try {
      return JSON.parse(raw) as StoredResponse[]
    } catch {
      return []
    }
  }

  private write(formId: string, responses: StoredResponse[]): void {
    this.storage.setItem(responsesKey(formId), JSON.stringify(responses))
  }

  async add(payload: ResponsePayload): Promise<StoredResponse> {
    const stored = await this.forms.get(payload.formId)
    const version = payload.formVersion ?? stored?.publishedVersion
    const snapshot =
      version !== undefined ? await this.forms.getSnapshot(payload.formId, version) : null
    if (snapshot === null || version === undefined) {
      throw new SubmissionRejectedError([
        { code: 'malformed', message: 'form has no published snapshot to submit against' },
      ])
    }

    const result = evaluateSubmission(snapshot, {
      answers: payload.answers,
      variables: payload.variables,
      hiddenFields: payload.hiddenFields,
    })
    if (!result.ok) throw new SubmissionRejectedError(result.issues)

    const response: StoredResponse = {
      id: crypto.randomUUID(),
      formId: payload.formId,
      formVersion: version,
      submittedAt: new Date().toISOString(),
      answers: result.answers,
      variables: result.variables,
      hidden: payload.hiddenFields ?? {},
      ending: result.ending,
    }
    this.write(payload.formId, [response, ...this.read(payload.formId)])
    return response
  }

  async list(formId: string, options: ListOptions = {}): Promise<ResponsePage> {
    const limit = clampLimit(options.limit)
    // read() is already newest-first (add prepends); slice keeps that order.
    const all = this.read(formId)
    const start =
      options.cursor === undefined
        ? 0
        : all.findIndex((response) => encodeCursor(response) === options.cursor) + 1
    const page = all.slice(start, start + limit)
    const last = page[page.length - 1]
    const nextCursor = start + limit < all.length && last !== undefined ? encodeCursor(last) : null
    return { responses: page, nextCursor }
  }

  async summary(formId: string): Promise<ResponseSummary> {
    const stored = await this.forms.get(formId)
    const version = stored?.publishedVersion
    const snapshot = version !== undefined ? await this.forms.getSnapshot(formId, version) : null
    const all = this.read(formId)
    if (snapshot === null) return { total: all.length, summary: [] }
    return { total: all.length, summary: summarize(snapshot, all) }
  }

  async get(formId: string, responseId: string): Promise<StoredResponse | null> {
    return this.read(formId).find((response) => response.id === responseId) ?? null
  }

  async remove(formId: string, responseId: string): Promise<void> {
    this.write(
      formId,
      this.read(formId).filter((response) => response.id !== responseId),
    )
  }

  async clear(formId: string): Promise<void> {
    this.storage.removeItem(responsesKey(formId))
  }
}
