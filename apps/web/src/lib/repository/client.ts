// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { LocalStorageFormsRepository } from './local'
import type { FormsRepository } from './types'

let instance: FormsRepository | null = null

/** Browser-side repository singleton. The api/db slice swaps this factory. */
export function getRepository(): FormsRepository {
  if (typeof window === 'undefined') {
    throw new Error('The forms repository is browser-only in M1 (local-first)')
  }
  if (instance === null) instance = new LocalStorageFormsRepository(window.localStorage)
  return instance
}
