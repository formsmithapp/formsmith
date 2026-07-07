// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'
import { starterForm } from '../seed'
import {
  FormClosedError,
  type ListOptions,
  type ResponsePage,
  type ResponsePayload,
  type ResponseSummary,
  type ResponsesRepository,
  type StoredResponse,
  SubmissionRejectedError,
} from './responses'
import {
  type FormSummary,
  type FormsRepository,
  PublishValidationError,
  type StoredForm,
} from './types'

/**
 * The HTTP repositories — the swap the M1/M4 seams were built for. Same
 * interfaces, same error classes; the transport changed from localStorage to
 * the mounted data plane at /api/v1. Everything above the seam (builder
 * store, dashboard, Results, Share) is untouched.
 */

const BASE = '/api/v1'

async function request<T>(path: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: init?.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    ...init,
  })
  const body = res.status === 204 ? (null as T) : ((await res.json().catch(() => null)) as T)
  return { status: res.status, body }
}

export class HttpFormsRepository implements FormsRepository {
  async list(): Promise<FormSummary[]> {
    const { body } = await request<{ forms: FormSummary[] }>('/forms')
    return body?.forms ?? []
  }

  async get(id: string): Promise<StoredForm | null> {
    const { status, body } = await request<StoredForm>(`/forms/${id}`)
    return status === 200 ? body : null
  }

  async create(seed?: FormDefinition): Promise<StoredForm> {
    const doc = seed ?? starterForm(crypto.randomUUID())
    const { status, body } = await request<StoredForm>('/forms', {
      method: 'POST',
      body: JSON.stringify({ doc }),
    })
    if (status !== 201) throw new Error(`create failed (${status})`)
    return body
  }

  async save(id: string, form: FormDefinition): Promise<void> {
    const { status } = await request(`/forms/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ doc: form }),
    })
    if (status !== 200) throw new Error(`save failed (${status})`)
  }

  async publish(id: string): Promise<{ version: number }> {
    const { status, body } = await request<
      { version: number } & { issues?: string[]; error?: string }
    >(`/forms/${id}/publish`, { method: 'POST' })
    if (status === 422) throw new PublishValidationError(body?.issues ?? ['invalid form'])
    if (status === 403 && body?.error === 'email_not_verified') {
      throw new Error('Verify your email to publish. Check your inbox for the confirmation link.')
    }
    if (status !== 200) throw new Error(`publish failed (${status})`)
    return { version: body.version }
  }

  async getSnapshot(id: string, version: number): Promise<FormDefinition | null> {
    const { status, body } = await request<{ form: FormDefinition }>(
      `/forms/${id}/versions/${version}`,
    )
    return status === 200 ? body.form : null
  }

  async duplicate(id: string): Promise<StoredForm> {
    const { status, body } = await request<StoredForm>(`/forms/${id}/duplicate`, {
      method: 'POST',
    })
    if (status !== 201) throw new Error(`duplicate failed (${status})`)
    return body
  }

  async remove(id: string): Promise<void> {
    await request(`/forms/${id}`, { method: 'DELETE' })
  }
}

export class HttpResponsesRepository implements ResponsesRepository {
  async add(payload: ResponsePayload): Promise<StoredResponse> {
    // the PUBLIC submit path — the server re-evaluates against the pinned snapshot
    const { status, body } = await request<
      StoredResponse & {
        issues?: import('@formsmithapp/engine').SubmissionIssue[]
        error?: string
      }
    >(`/f/${payload.formId}/responses`, {
      method: 'POST',
      body: JSON.stringify({
        formVersion: payload.formVersion,
        answers: payload.answers,
        variables: payload.variables,
        hiddenFields: payload.hiddenFields,
        aiExchanges: payload.aiExchanges,
        _hp: payload._hp,
      }),
    })
    if (status === 422) throw new SubmissionRejectedError(body?.issues ?? [])
    // monthly cap reached: a permanent refusal the retry queue must not retry
    if (status === 403 && body?.error === 'form_over_capacity') throw new FormClosedError()
    if (status !== 201) throw new Error(`submit failed (${status})`)
    return body
  }

  async list(formId: string, options: ListOptions = {}): Promise<ResponsePage> {
    const params = new URLSearchParams()
    if (options.limit !== undefined) params.set('limit', String(options.limit))
    if (options.cursor !== undefined) params.set('cursor', options.cursor)
    const query = params.toString()
    const { body } = await request<{ responses: StoredResponse[]; nextCursor: string | null }>(
      `/forms/${formId}/responses${query !== '' ? `?${query}` : ''}`,
    )
    return { responses: body?.responses ?? [], nextCursor: body?.nextCursor ?? null }
  }

  async summary(formId: string): Promise<ResponseSummary> {
    const { body } = await request<ResponseSummary>(`/forms/${formId}/responses/summary`)
    return { total: body?.total ?? 0, summary: body?.summary ?? [] }
  }

  async get(formId: string, responseId: string): Promise<StoredResponse | null> {
    const { status, body } = await request<StoredResponse>(
      `/forms/${formId}/responses/${responseId}`,
    )
    return status === 200 ? body : null
  }

  async remove(formId: string, responseId: string): Promise<void> {
    await request(`/forms/${formId}/responses/${responseId}`, { method: 'DELETE' })
  }

  async clear(formId: string): Promise<void> {
    // Delete-then-refetch the first page until the form is empty; keyset pages
    // would otherwise shift underneath a cursor as rows are removed.
    let page = await this.list(formId, { limit: 200 })
    while (page.responses.length > 0) {
      for (const response of page.responses) await this.remove(formId, response.id)
      page = await this.list(formId, { limit: 200 })
    }
  }
}
