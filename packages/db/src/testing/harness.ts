// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { Database } from '../client'
import * as schema from '../schema'

/**
 * Test database: real Postgres semantics, in-process, zero infra (PGlite).
 * Applies the SAME committed migrations production runs — the migration
 * files themselves are under test on every run.
 */
export async function createTestDb(): Promise<Database> {
  const client = new PGlite()
  const db = drizzle(client, { schema })
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  })
  // PGlite's drizzle instance matches the postgres-js one for everything the
  // repositories use — the cast is the price of one Database type.
  return db as unknown as Database
}

/** Repositories need users to exist (memberships FK) — a minimal fixture. */
export async function createTestUser(db: Database, id: string): Promise<string> {
  await db.insert(schema.user).values({
    id,
    name: `User ${id}`,
    email: `${id}@example.test`,
  })
  return id
}
