// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ping } from '@formsmithapp/db'
import { getDb } from '@/lib/db'

/**
 * Liveness + readiness for the self-host build: Docker HEALTHCHECK, compose
 * `depends_on`, and uptime monitors all hit this. Checks the database (the
 * only hard dependency) and reports the running version.
 */

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const version = process.env.FORMSMITH_VERSION ?? 'dev'
  try {
    await ping(getDb())
    return Response.json({ status: 'ok', version })
  } catch {
    return Response.json({ status: 'unavailable', version }, { status: 503 })
  }
}
