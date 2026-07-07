// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createWorkspaceWithOwner, schema } from '@formsmithapp/db'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { captcha } from 'better-auth/plugins'
import { getDb } from './db'
import { envFlag, serverEnv } from './env'
import { getMail } from './workers'

/**
 * Whether the instance ENFORCES email verification (v0.1.5 §B). Off by default.
 * Fail-open safety net: if the flag is on but no mail sender is configured we
 * do NOT enforce (and warn loudly), so a self-hoster mid-setup is never locked
 * out of their own instance. Hosted sets the flag AND SMTP, so it enforces.
 */
export function emailVerificationRequired(): boolean {
  if (!envFlag(serverEnv().FORMSMITH_REQUIRE_EMAIL_VERIFICATION)) return false
  if (!getMail().configured) {
    console.warn(
      '[auth] FORMSMITH_REQUIRE_EMAIL_VERIFICATION is set but no mail sender is configured; ' +
        'verification is NOT being enforced (set SMTP_URL + EMAIL_FROM to enable it).',
    )
    return false
  }
  return true
}

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
  const verify = emailVerificationRequired()
  // Turnstile needs BOTH keys: the secret verifies server-side, the site key
  // lets the client mint a token. Enabling one without the other would break
  // every sign-in, so both-or-neither.
  const turnstileOn = env.TURNSTILE_SECRET_KEY !== undefined && env.TURNSTILE_SITE_KEY !== undefined
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), { provider: 'pg', schema }),
    // Soft gate: unverified accounts CAN sign in (build/preview); the API layer
    // blocks publish + AI. So `requireEmailVerification` stays OFF; we only send
    // the mail (on signup, when enforcement is on).
    emailAndPassword: { enabled: true, disableSignUp: signupDisabled, minPasswordLength: 10 },
    emailVerification: {
      sendOnSignUp: verify,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await getMail().send({
          to: user.email,
          subject: 'Confirm your email for Formsmith',
          text: `Confirm your email to finish setting up your Formsmith account:\n\n${url}\n\nIf you did not sign up, you can ignore this message.`,
        })
      },
    },
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
    // nextCookies() MUST stay last (it wraps cookie handling for the others).
    plugins: [
      ...(turnstileOn
        ? [captcha({ provider: 'cloudflare-turnstile', secretKey: env.TURNSTILE_SECRET_KEY ?? '' })]
        : []),
      nextCookies(),
    ],
  })
}

/** The public Turnstile site key for the client widget, or null when off. */
export function turnstileSiteKey(): string | null {
  const env = serverEnv()
  return env.TURNSTILE_SECRET_KEY !== undefined && env.TURNSTILE_SITE_KEY !== undefined
    ? env.TURNSTILE_SITE_KEY
    : null
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
