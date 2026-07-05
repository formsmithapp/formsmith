// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { NoopMail, PgBossQueue, SmtpMail } from '@formsmithapp/adapters'
import { createDb } from '@formsmithapp/db'
import { serve } from '@hono/node-server'
import { createApi } from './index'
import { startWorkers } from './workers'

/**
 * Standalone entry — NOT used by the v1 unified build (Next mounts the app
 * instead). This is the Phase-1 path: the same data plane + workers on their
 * own process. Session resolution must be provided by the deployment;
 * standalone v1 serves the PUBLIC + bearer-key surface.
 */
const port = Number(process.env.PORT ?? 8787)
const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined) throw new Error('DATABASE_URL is required')

const db = createDb(databaseUrl)
const queue = new PgBossQueue(databaseUrl)
const mail =
  process.env.SMTP_URL !== undefined && process.env.EMAIL_FROM !== undefined
    ? new SmtpMail(process.env.SMTP_URL, process.env.EMAIL_FROM)
    : new NoopMail()

const app = createApi({
  db,
  getSession: async () => null, // no auth host — session routes 401 by design
  queue,
  mail,
})

await startWorkers({
  db,
  queue,
  mail,
  baseUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
})

serve({ fetch: app.fetch, port })
console.log(`formsmith data plane listening on :${port}`)
