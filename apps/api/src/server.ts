// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createDb } from '@formsmithapp/db'
import { serve } from '@hono/node-server'
import { createApi } from './index'

/**
 * Standalone entry — NOT used by the v1 unified build (Next mounts the app
 * instead). This is the Phase-1 path: the same data plane on its own
 * process/Workers. Session resolution must be provided by the deployment;
 * standalone v1 serves the PUBLIC surface only.
 */
const port = Number(process.env.PORT ?? 8787)
const databaseUrl = process.env.DATABASE_URL
if (databaseUrl === undefined) throw new Error('DATABASE_URL is required')

const app = createApi({
  db: createDb(databaseUrl),
  getSession: async () => null, // no auth host — dashboard routes 401 by design
})

serve({ fetch: app.fetch, port })
console.log(`formsmith data plane listening on :${port}`)
