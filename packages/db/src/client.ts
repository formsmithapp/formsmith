// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/** The `DbClient` boundary — everything downstream types against this. */
export type Database = PostgresJsDatabase<typeof schema>

export function createDb(connectionString: string): Database {
  const sql = postgres(connectionString, { max: 10 })
  return drizzle(sql, { schema })
}
