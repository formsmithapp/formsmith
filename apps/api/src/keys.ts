// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash, randomBytes } from 'node:crypto'

/**
 * API-key material. The secret is shown ONCE at creation; only its sha256
 * lands in the database. Authentication hashes the presented secret and
 * looks the hash up — no in-memory secret comparison exists to be timed.
 */

export interface GeneratedApiKey {
  /** `fsk_` + 32 random bytes, base64url. Show once, never store, never log. */
  secret: string
  keyHash: string
  /** First 12 chars — enough to identify a key in a list, useless to attackers. */
  prefix: string
}

export function generateApiKey(): GeneratedApiKey {
  const secret = `fsk_${randomBytes(32).toString('base64url')}`
  return { secret, keyHash: hashApiKey(secret), prefix: secret.slice(0, 12) }
}

export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

/** Per-webhook signing secret (shown once at creation; rotation is EE). */
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`
}
