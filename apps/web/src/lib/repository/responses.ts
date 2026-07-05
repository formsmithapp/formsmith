// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { evaluateSubmission, type SubmissionIssue } from '@formsmithapp/engine'
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
}

export class SubmissionRejectedError extends Error {
  readonly issues: readonly SubmissionIssue[]

  constructor(issues: readonly SubmissionIssue[]) {
    super(`Submission rejected: ${issues.map((issue) => issue.code).join(', ')}`)
    this.name = 'SubmissionRejectedError'
    this.issues = issues
  }
}

export interface ResponsesRepository {
  /** Re-evaluates against the pinned snapshot; stores; rejects invalid. */
  add(payload: ResponsePayload): Promise<StoredResponse>
  /** Newest first. */
  list(formId: string): Promise<StoredResponse[]>
  get(formId: string, responseId: string): Promise<StoredResponse | null>
  remove(formId: string, responseId: string): Promise<void>
  clear(formId: string): Promise<void>
}

const responsesKey = (formId: string) => `fs.responses.${formId}`

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

  async list(formId: string): Promise<StoredResponse[]> {
    return this.read(formId)
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
