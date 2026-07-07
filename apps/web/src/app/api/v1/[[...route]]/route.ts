// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { InMemoryLruCache } from '@formsmithapp/adapters'
import { resolveProviders } from '@formsmithapp/ai'
import { createApi } from '@formsmithapp/api'
import { handle } from 'hono/vercel'
import { emailVerificationRequired, getAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { serverEnv } from '@/lib/env'
import { getMail, getQueue } from '@/lib/workers'

// The v1 unified build: the SAME Hono app that can deploy standalone is
// mounted here at /api/v1. Lazy so `next build` needs no environment.
let handler: ((req: Request) => Response | Promise<Response>) | null = null

function getHandler() {
  if (handler === null) {
    const provider = resolveProviders(process.env)
    const api = createApi({
      db: getDb(),
      getSession: async (headers) => {
        const session = await getAuth().api.getSession({ headers })
        return session === null
          ? null
          : { userId: session.user.id, emailVerified: session.user.emailVerified === true }
      },
      requireVerifiedEmail: emailVerificationRequired(),
      queue: getQueue(),
      mail: getMail(),
      ai: provider === null ? undefined : { provider },
      signingSecret: serverEnv().BETTER_AUTH_SECRET,
      submitRatePerMinute: serverEnv().FORMSMITH_SUBMIT_RATE,
      // v1.1: REDIS_URL swaps this for a RedisCache behind the same interface
      cache: new InMemoryLruCache(serverEnv().FORMSMITH_CACHE_MAX_ITEMS ?? 500),
      // v0.1.5 quotas: every value unset = unlimited (self-host default)
      quotas: {
        aiCreditsDefault: serverEnv().FORMSMITH_AI_CREDITS_DEFAULT,
        aiGenerationCost: serverEnv().FORMSMITH_AI_GENERATION_COST,
        forms: serverEnv().FORMSMITH_LIMIT_FORMS,
        responsesPerMonth: serverEnv().FORMSMITH_LIMIT_RESPONSES_MONTH,
        webhooksPerForm: serverEnv().FORMSMITH_LIMIT_WEBHOOKS,
        apiKeysPerWorkspace: serverEnv().FORMSMITH_LIMIT_API_KEYS,
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
