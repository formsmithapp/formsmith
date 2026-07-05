// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { HttpFormsRepository, HttpResponsesRepository } from './http'
import type { ResponsesRepository } from './responses'
import type { FormsRepository } from './types'

let instance: FormsRepository | null = null
let responsesInstance: ResponsesRepository | null = null

/**
 * Browser-side repository singletons — since S2 these speak HTTP to the
 * mounted data plane (/api/v1). The localStorage implementations remain in
 * the tree as unit-test fixtures and as the import-banner's read source.
 */
export function getRepository(): FormsRepository {
  if (typeof window === 'undefined') {
    throw new Error('The forms repository is browser-only (server code reads the db directly)')
  }
  if (instance === null) instance = new HttpFormsRepository()
  return instance
}

export function getResponsesRepository(): ResponsesRepository {
  if (typeof window === 'undefined') {
    throw new Error('The responses repository is browser-only (server code reads the db directly)')
  }
  if (responsesInstance === null) responsesInstance = new HttpResponsesRepository()
  return responsesInstance
}
