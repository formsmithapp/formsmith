// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createApi } from '@formsmithapp/api'
import { handle } from 'hono/vercel'
import { getAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

// The v1 unified build: the SAME Hono app that can deploy standalone is
// mounted here at /api/v1. Lazy so `next build` needs no environment.
let handler: ((req: Request) => Response | Promise<Response>) | null = null

function getHandler() {
  if (handler === null) {
    const api = createApi({
      db: getDb(),
      getSession: async (headers) => {
        const session = await getAuth().api.getSession({ headers })
        return session === null ? null : { userId: session.user.id }
      },
    })
    handler = handle(api)
  }
  return handler
}

export const GET = (req: Request) => getHandler()(req)
export const POST = (req: Request) => getHandler()(req)
export const PUT = (req: Request) => getHandler()(req)
export const DELETE = (req: Request) => getHandler()(req)
