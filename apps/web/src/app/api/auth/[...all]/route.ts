// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { getAuth } from '@/lib/auth'

// Better Auth owns /api/auth/* — the handler is resolved lazily so the
// module can load without an environment (build time).
export async function GET(request: Request) {
  return getAuth().handler(request)
}

export async function POST(request: Request) {
  return getAuth().handler(request)
}
