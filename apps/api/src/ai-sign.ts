// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * AI exchange signing — client-for-UX, server-for-truth extended to AI.
 * Every generated (or fallback) question the server issues is HMAC-signed
 * together with its trace metadata; the client carries it through the
 * session and returns it at submit, where every signature is verified.
 * A respondent cannot forge "the AI asked me X" or its audit trail.
 * Stateless: no session store, the signature IS the state.
 */

export interface ExchangeTuple {
  formId: string
  ref: string
  index: number
  question: string
  /** Trace metadata (type/engagement/model/latency/fallback). Round-trips
   * through client JSON — key order survives parse/stringify of the same
   * document, so the signature stays stable. */
  meta: Record<string, unknown>
}

const payload = (tuple: ExchangeTuple) =>
  `${tuple.formId}|${tuple.ref}|${tuple.index}|${tuple.question}|${JSON.stringify(tuple.meta)}`

export function signExchange(secret: string, tuple: ExchangeTuple): string {
  return createHmac('sha256', secret).update(payload(tuple)).digest('hex')
}

export function verifyExchange(secret: string, tuple: ExchangeTuple, sig: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(sig)) return false
  const expected = Buffer.from(signExchange(secret, tuple), 'hex')
  const provided = Buffer.from(sig, 'hex')
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}
