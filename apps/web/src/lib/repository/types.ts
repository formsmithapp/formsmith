// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'

/**
 * The persistence boundary. M1 backs it with localStorage; the api/db slice
 * swaps in an HTTP implementation behind the SAME interface — which is why
 * every method is async even though localStorage is synchronous.
 */

export interface FormSummary {
  id: string
  title: string
  status: 'draft' | 'published'
  publishedVersion?: number
  blockCount: number
  updatedAt: string
}

export interface StoredForm {
  form: FormDefinition
  status: 'draft' | 'published'
  publishedVersion?: number
  createdAt: string
  updatedAt: string
}

/** Publish failed the validity gate (engine parse + block property schemas). */
export class PublishValidationError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`Form failed publish validation: ${issues.join('; ')}`)
    this.name = 'PublishValidationError'
    this.issues = issues
  }
}

export interface FormsRepository {
  list(): Promise<FormSummary[]>
  get(id: string): Promise<StoredForm | null>
  create(seed?: FormDefinition): Promise<StoredForm>
  save(id: string, form: FormDefinition): Promise<void>
  /** Validates, bumps the version, writes an immutable snapshot. */
  publish(id: string): Promise<{ version: number }>
  getSnapshot(id: string, version: number): Promise<FormDefinition | null>
  duplicate(id: string): Promise<StoredForm>
  remove(id: string): Promise<void>
}
