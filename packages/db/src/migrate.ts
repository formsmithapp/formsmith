// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

/**
 * Programmatic migration runner — "migrations on boot" for the self-host
 * build. Uses drizzle-orm's migrator against the committed `drizzle/` folder
 * (NOT drizzle-kit, which stays a dev dependency). Idempotent: applied
 * migrations are tracked in drizzle's own journal table, so re-running on
 * every boot is a no-op.
 */

export interface MigrateOptions {
  /**
   * Where the SQL migrations live. Defaults to the `drizzle/` folder shipped
   * with this package; the Docker image copies it to a fixed path and points
   * FORMSMITH_MIGRATIONS_DIR at it (fs reads aren't traced into standalone
   * output, so the path must be explicit there).
   */
  migrationsFolder?: string
  /** Connection attempts before giving up (postgres may still be booting). */
  attempts?: number
  /** Delay between attempts. */
  delayMs?: number
  log?: (message: string) => void
}

/**
 * Bundlers (Turbopack in the unified build) inline this module, so
 * import.meta.url is useless for locating the SQL folder. The default walks
 * node_modules from the working directory (works for dev and `next start`);
 * the Docker image ships the folder at a fixed path via
 * FORMSMITH_MIGRATIONS_DIR instead.
 */
function defaultMigrationsFolder(): string {
  const candidate = join(process.cwd(), 'node_modules', '@formsmithapp', 'db', 'drizzle')
  if (existsSync(candidate)) return candidate
  throw new Error(
    `migrations folder not found at ${candidate} — set FORMSMITH_MIGRATIONS_DIR to the drizzle/ directory`,
  )
}

export async function runMigrations(
  connectionString: string,
  options: MigrateOptions = {},
): Promise<void> {
  const folder = options.migrationsFolder ?? defaultMigrationsFolder()
  const attempts = options.attempts ?? 5
  const delayMs = options.delayMs ?? 3_000
  const log = options.log ?? ((message: string) => console.log(message))

  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const sql = postgres(connectionString, { max: 1, onnotice: () => {} })
    try {
      await migrate(drizzle(sql), { migrationsFolder: folder })
      log(`[migrate] schema is up to date (${folder})`)
      return
    } catch (error) {
      lastError = error
      if (attempt < attempts) {
        log(`[migrate] attempt ${attempt}/${attempts} failed, retrying in ${delayMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    } finally {
      await sql.end()
    }
  }
  throw lastError
}
