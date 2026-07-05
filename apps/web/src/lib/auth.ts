// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createWorkspaceWithOwner, schema } from '@formsmithapp/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { getDb } from './db'
import { serverEnv } from './env'

/**
 * Better Auth — a LIBRARY running in-process against our Postgres; no
 * external service. Lazy singleton so `next build` needs no environment.
 *
 * - email+password is always on (single-step: name + email + password).
 * - Google/GitHub register ONLY when their env creds exist — self-hosters
 *   without OAuth apps never see broken buttons.
 * - Sign-up bootstraps the personal workspace (v1 §9) via a database hook.
 */

function buildAuth() {
  const env = serverEnv()
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
    emailAndPassword: { enabled: true },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
        ? {
            google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID !== undefined && env.GITHUB_CLIENT_SECRET !== undefined
        ? {
            github: { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET },
          }
        : {}),
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await createWorkspaceWithOwner(getDb(), user.id, `${user.name}'s workspace`)
          },
        },
      },
    },
    plugins: [nextCookies()],
  })
}

let instance: ReturnType<typeof buildAuth> | null = null

export function getAuth() {
  if (instance === null) instance = buildAuth()
  return instance
}

/** Which social buttons to render — server-only (reads env). */
export function enabledSocialProviders(): { google: boolean; github: boolean } {
  const env = serverEnv()
  return {
    google: env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined,
    github: env.GITHUB_CLIENT_ID !== undefined && env.GITHUB_CLIENT_SECRET !== undefined,
  }
}
