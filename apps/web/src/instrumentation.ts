// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Next boot hook: applies pending database migrations, then starts the
 * background workers (webhook delivery, email notifications, nightly
 * maintenance) inside the unified build. "Migrations on boot" makes upgrades
 * one step for self-hosters: pull the new image, restart. Skips quietly when
 * no environment is present (e.g. `next build` on a machine without a
 * database) — a booted SERVER without env still fails loud on the first
 * request, which is where the failure belongs.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl === undefined) {
    console.warn('[boot] DATABASE_URL not set — migrations and background workers skipped')
    return
  }
  const { runMigrations } = await import('@formsmithapp/db')
  await runMigrations(databaseUrl, {
    migrationsFolder: process.env.FORMSMITH_MIGRATIONS_DIR,
  })
  const { startAppWorkers } = await import('./lib/workers')
  await startAppWorkers()
}
