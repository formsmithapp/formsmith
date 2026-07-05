// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Next boot hook: starts the background workers (webhook delivery, email
 * notifications, nightly maintenance) inside the unified build. Skips
 * quietly when no environment is present (e.g. `next build` on a machine
 * without a database) — a booted SERVER without env still fails loud on the
 * first request, which is where the failure belongs.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.DATABASE_URL === undefined) {
    console.warn('[workers] DATABASE_URL not set — background workers not started')
    return
  }
  const { startAppWorkers } = await import('./lib/workers')
  await startAppWorkers()
}
