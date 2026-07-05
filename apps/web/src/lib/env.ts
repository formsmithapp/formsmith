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
})

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
