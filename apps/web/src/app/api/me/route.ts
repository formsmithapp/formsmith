// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { workspaceForUser } from '@formsmithapp/db'
import { getAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

/** The signed-in identity + their (auto-created) workspace — powers the user menu. */
export async function GET(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers })
  if (session === null) return Response.json(null, { status: 401 })
  const workspace = await workspaceForUser(getDb(), session.user.id)
  return Response.json({
    user: { name: session.user.name, email: session.user.email },
    workspace,
  })
}
