// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'

/**
 * Server-side environment, zod-validated. Parsed LAZILY on first use (not at
 * import) so `next build` needs no environment — misconfiguration still fails
 * loud on the first request that touches the database or auth.
 */

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (see .env.example)'),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, 'BETTER_AUTH_SECRET must be a strong random string (openssl rand -base64 32)'),
  BETTER_AUTH_URL: z.url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  /** BYO SMTP — unset means notifications degrade gracefully (NoopMail). */
  SMTP_URL: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** BYO LLM — all optional; nothing set means AI off, fallbacks only. */
  ANTHROPIC_API_KEY: z.string().optional(),
  FORMSMITH_AI_MODEL: z.string().optional(),
  OPENAI_COMPAT_BASE_URL: z.string().optional(),
  OPENAI_COMPAT_API_KEY: z.string().optional(),
  OPENAI_COMPAT_MODEL: z.string().optional(),
  FORMSMITH_AI_FALLBACK_PROVIDER: z.enum(['anthropic', 'openai-compatible']).optional(),
  FORMSMITH_AI_FALLBACK_API_KEY: z.string().optional(),
  FORMSMITH_AI_FALLBACK_MODEL: z.string().optional(),
  FORMSMITH_AI_FALLBACK_BASE_URL: z.string().optional(),
  FORMSMITH_AI_HEDGE_MS: z.string().optional(),
  FORMSMITH_AI_TIMEOUT_MS: z.string().optional(),
  /** 'mock' enables the deterministic dev/test provider. */
  FORMSMITH_AI: z.enum(['mock']).optional(),
  /** Self-host toggles — truthy values: 'true' | '1'. */
  FORMSMITH_HIDE_BADGE: z.string().optional(),
  FORMSMITH_DISABLE_SIGNUP: z.string().optional(),
  /** Require a verified email to publish + use AI credits (v0.1.5). Off by
   * default: a fresh self-host with no SMTP must not lock the owner out. */
  FORMSMITH_REQUIRE_EMAIL_VERIFICATION: z.string().optional(),
  /** Cloudflare Turnstile on signup/signin. Both set = on; unset = off (OSS
   * default, zero new deps). Site key is public (passed to the client at
   * runtime, never NEXT_PUBLIC, so one image serves any instance). */
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_SITE_KEY: z.string().optional(),
  /** Optional host split. Set to a dedicated public-forms host to serve
   * respondent pages on their own host; unset = single-host, current behavior
   * untouched. The proxy reads process.env directly; this documents it and keeps
   * validation uniform. The app host is derived from BETTER_AUTH_URL. */
  FORMSMITH_FORMS_HOST: z.string().optional(),
  /** Lets webhook deliveries reach private/loopback addresses (e.g. n8n on the same box). */
  WEBHOOK_ALLOW_PRIVATE: z.string().optional(),
  /** Public submit endpoint rate limit per ip+form, per minute. Default 60. */
  FORMSMITH_SUBMIT_RATE: z.coerce.number().int().positive().optional(),
  /** Max entries in the in-memory cache (snapshots, rate windows). Default 500. */
  FORMSMITH_CACHE_MAX_ITEMS: z.coerce.number().int().positive().optional(),
  /** AI credits + workspace quotas. Every one unset = unlimited (the default);
   * set strict values to meter usage. Generic core, no deployment-specific paths. */
  FORMSMITH_AI_CREDITS_DEFAULT: z.coerce.number().int().nonnegative().optional(),
  /** Credits spent per AI form generation. Default 5. (Exchanges cost 1.) */
  FORMSMITH_AI_GENERATION_COST: z.coerce.number().int().positive().optional(),
  FORMSMITH_LIMIT_FORMS: z.coerce.number().int().nonnegative().optional(),
  FORMSMITH_LIMIT_RESPONSES_MONTH: z.coerce.number().int().nonnegative().optional(),
  FORMSMITH_LIMIT_WEBHOOKS: z.coerce.number().int().nonnegative().optional(),
  FORMSMITH_LIMIT_API_KEYS: z.coerce.number().int().nonnegative().optional(),
})

/** Shared truthiness rule for the self-host env toggles. */
export function envFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1'
}

export type ServerEnv = z.infer<typeof envSchema>

let cached: ServerEnv | null = null

export function serverEnv(): ServerEnv {
  if (cached !== null) return cached
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n  ')
    throw new Error(`Invalid environment:\n  ${issues}`)
  }
  cached = result.data
  return cached
}
