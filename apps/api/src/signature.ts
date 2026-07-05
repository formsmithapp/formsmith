// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Webhook signatures — Stripe-style timestamped HMAC:
 *
 *   X-Formsmith-Signature: t=<unix-seconds>,v1=<hex hmac-sha256(secret, "<t>.<raw-body>")>
 *
 * The timestamp inside the signed payload makes captured deliveries
 * replay-resistant (±5 min tolerance by default). The SAME functions are the
 * public verification recipe (docs/webhooks.md) — recipe and implementation
 * cannot drift because they are one codepath, unit-tested.
 */

export function signWebhookPayload(secret: string, body: string, timestampSeconds: number): string {
  const v1 = createHmac('sha256', secret).update(`${timestampSeconds}.${body}`).digest('hex')
  return `t=${timestampSeconds},v1=${v1}`
}

export interface VerifyOptions {
  toleranceSeconds?: number
  /** Injectable clock for tests. */
  nowSeconds?: number
}

export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  options: VerifyOptions = {},
): boolean {
  const match = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header.trim())
  if (match === null) return false
  const timestamp = Number(match[1])
  const provided = match[2] ?? ''

  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000)
  const tolerance = options.toleranceSeconds ?? 300
  if (Math.abs(now - timestamp) > tolerance) return false

  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  const a = Buffer.from(expected, 'hex')
  const b = Buffer.from(provided, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}
