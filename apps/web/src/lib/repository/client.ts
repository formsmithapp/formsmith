// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { LocalStorageFormsRepository } from './local'
import { LocalStorageResponsesRepository, type ResponsesRepository } from './responses'
import type { FormsRepository } from './types'

let instance: FormsRepository | null = null
let responsesInstance: ResponsesRepository | null = null

/** Browser-side repository singleton. The api/db slice swaps this factory. */
export function getRepository(): FormsRepository {
  if (typeof window === 'undefined') {
    throw new Error('The forms repository is browser-only in M1 (local-first)')
  }
  if (instance === null) instance = new LocalStorageFormsRepository(window.localStorage)
  return instance
}

/** Browser-side responses singleton — same swap point as the forms repository. */
export function getResponsesRepository(): ResponsesRepository {
  if (typeof window === 'undefined') {
    throw new Error('The responses repository is browser-only in M4 (local-first)')
  }
  if (responsesInstance === null) {
    responsesInstance = new LocalStorageResponsesRepository(window.localStorage, getRepository())
  }
  return responsesInstance
}
