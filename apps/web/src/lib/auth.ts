// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createWorkspaceWithOwner, schema } from '@formsmithapp/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { getDb } from './db'
import { envFlag, serverEnv } from './env'

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
  const signupDisabled = envFlag(env.FORMSMITH_DISABLE_SIGNUP)
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
    emailAndPassword: { enabled: true, disableSignUp: signupDisabled, minPasswordLength: 10 },
    // brute-force protection on the auth surface (S5 hardening); in-memory
    // storage matches the single-instance v1 deployment
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 10 },
        '/forget-password': { window: 60, max: 5 },
      },
    },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID !== undefined && env.GOOGLE_CLIENT_SECRET !== undefined
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              disableSignUp: signupDisabled,
            },
          }
        : {}),
      ...(env.GITHUB_CLIENT_ID !== undefined && env.GITHUB_CLIENT_SECRET !== undefined
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID,
              clientSecret: env.GITHUB_CLIENT_SECRET,
              disableSignUp: signupDisabled,
            },
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

/** FORMSMITH_DISABLE_SIGNUP — instance owners can close registration. */
export function signupDisabled(): boolean {
  return envFlag(serverEnv().FORMSMITH_DISABLE_SIGNUP)
}
