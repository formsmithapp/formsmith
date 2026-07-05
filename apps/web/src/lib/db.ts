// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createDb, type Database } from '@formsmithapp/db'
import { serverEnv } from './env'

/** Lazy server-side db singleton — nothing connects at build time. */
let instance: Database | null = null

export function getDb(): Database {
  if (instance === null) instance = createDb(serverEnv().DATABASE_URL)
  return instance
}
