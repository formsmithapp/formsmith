// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { generateApiKey, hashApiKey } from './keys'
import { signWebhookPayload, verifyWebhookSignature } from './signature'

const SECRET = 'whsec_test_secret'
const BODY = '{"event":"response.created","response":{"id":"r1"}}'

describe('webhook signature (THE documented recipe)', () => {
  it('sign → verify round-trips', () => {
    const now = 1_760_000_000
    const header = signWebhookPayload(SECRET, BODY, now)
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/)
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowSeconds: now })).toBe(true)
  })

  it('rejects a tampered body', () => {
    const now = 1_760_000_000
    const header = signWebhookPayload(SECRET, BODY, now)
    expect(
      verifyWebhookSignature(SECRET, BODY.replace('r1', 'r2'), header, { nowSeconds: now }),
    ).toBe(false)
  })

  it('rejects the wrong secret', () => {
    const now = 1_760_000_000
    const header = signWebhookPayload(SECRET, BODY, now)
    expect(verifyWebhookSignature('whsec_other', BODY, header, { nowSeconds: now })).toBe(false)
  })

  it('REPLAY: rejects signatures outside the tolerance window', () => {
    const then = 1_760_000_000
    const header = signWebhookPayload(SECRET, BODY, then)
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowSeconds: then + 301 })).toBe(false)
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowSeconds: then + 299 })).toBe(true)
    expect(verifyWebhookSignature(SECRET, BODY, header, { nowSeconds: then - 301 })).toBe(false)
  })

  it('rejects malformed headers', () => {
    expect(verifyWebhookSignature(SECRET, BODY, '')).toBe(false)
    expect(verifyWebhookSignature(SECRET, BODY, 'v1=abc')).toBe(false)
    expect(verifyWebhookSignature(SECRET, BODY, 't=123,v1=nothex')).toBe(false)
  })
})

describe('api key material', () => {
  it('generates fsk_ secrets whose hash round-trips and prefix identifies', () => {
    const key = generateApiKey()
    expect(key.secret).toMatch(/^fsk_[A-Za-z0-9_-]{43}$/)
    expect(key.prefix).toBe(key.secret.slice(0, 12))
    expect(key.keyHash).toBe(hashApiKey(key.secret))
    expect(key.keyHash).toMatch(/^[0-9a-f]{64}$/)
    expect(generateApiKey().secret).not.toBe(key.secret)
  })
})
