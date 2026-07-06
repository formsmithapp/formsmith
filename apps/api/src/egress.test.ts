// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { guardedLookup, isPrivateAddress, urlTargetsPrivate } from './egress'

describe('S5: SSRF egress guard', () => {
  it('blocks every private/reserved v4 range', () => {
    for (const ip of [
      '0.0.0.0',
      '0.255.1.2',
      '10.0.0.1',
      '10.255.255.255',
      '100.64.0.1', // CGNAT
      '100.127.255.254',
      '127.0.0.1',
      '127.255.255.255',
      '169.254.169.254', // cloud metadata
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '192.0.0.1',
      '198.18.0.1', // benchmarking
      '224.0.0.1', // multicast
      '255.255.255.255',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
  })

  it('passes public v4 addresses', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '100.128.0.1', '172.32.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })

  it('blocks private v6 forms, including v4-mapped tricks', () => {
    for (const ip of [
      '::1',
      '::',
      'fc00::1', // unique-local
      'fdff::1',
      'fe80::1', // link-local
      'fe80::1%eth0', // zone id
      '::ffff:127.0.0.1', // v4-mapped loopback
      '::ffff:10.0.0.1',
      '::ffff:7f00:1', // v4-mapped loopback, hex form
      '64:ff9b::a00:1', // NAT64 hex form
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    expect(isPrivateAddress('2606:4700:4700::1111')).toBe(false) // public v6
  })

  it('treats non-IP garbage as blocked', () => {
    expect(isPrivateAddress('not-an-ip')).toBe(true)
  })

  it('urlTargetsPrivate catches literal-IP and localhost URLs (they bypass DNS)', () => {
    for (const url of [
      'http://localhost:5678/hook',
      'https://sub.localhost/hook',
      'https://127.0.0.1/hook',
      'https://[::1]:8443/hook',
      'https://10.1.2.3/hook',
      'https://169.254.169.254/latest/meta-data',
      'not a url at all',
    ]) {
      expect(urlTargetsPrivate(url), url).toBe(true)
    }
    // real hostnames pass here — the connect-time guarded lookup owns those
    expect(urlTargetsPrivate('https://example.com/hook')).toBe(false)
    expect(urlTargetsPrivate('https://1.1.1.1/hook')).toBe(false)
  })

  it('guardedLookup fails the connection when the name resolves private', async () => {
    // localhost resolves locally (no external DNS) — the rebinding-shaped case
    const error = await new Promise<Error | null>((resolve) => {
      guardedLookup('localhost', {}, (err) => resolve(err))
    })
    expect(error).not.toBeNull()
    expect((error as NodeJS.ErrnoException).code).toBe('EEGRESSBLOCKED')
    expect(error?.message).toContain('WEBHOOK_ALLOW_PRIVATE')
  })
})
