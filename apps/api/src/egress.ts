// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import { isIP } from 'node:net'
import { Agent } from 'undici'

/**
 * SSRF egress guard for webhook delivery. The block is enforced at
 * socket-CONNECT time via a guarded DNS lookup on the undici Agent — the
 * addresses the socket dials are the exact addresses we validated, so a
 * rebinding DNS record can't slip a private target past a pre-check.
 * Literal-IP URLs never hit the resolver, so those are validated separately
 * (`urlTargetsPrivate`) before the request is made.
 *
 * Self-hosters delivering to services on their own network (n8n on the same
 * box is the flagship case) opt out with WEBHOOK_ALLOW_PRIVATE=true — the
 * DEFAULT must be safe on the open internet.
 */

/** Is this IP (v4 or v6) in a private/reserved/loopback/link-local range? */
export function isPrivateAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return isPrivateV4(address)
  if (family === 6) return isPrivateV6(address)
  return true // not an IP — never dial it
}

function isPrivateV4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true
  const [a, b] = parts as [number, number, number, number]
  if (a === 0) return true // 0.0.0.0/8 ("this network")
  if (a === 10) return true // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true // 100.64.0.0/10 (CGNAT)
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 192 && b === 0) return true // 192.0.0.0/24 + 192.0.2.0/24 (doc)
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a >= 224) return true // multicast + reserved + broadcast
  return false
}

function isPrivateV6(address: string): boolean {
  const lower = address.toLowerCase().replace(/%.*$/, '') // strip zone id
  if (lower === '::' || lower === '::1') return true // unspecified + loopback
  // v4-mapped/translated (::ffff:a.b.c.d, 64:ff9b::/96) — validate the v4 tail
  const v4Tail = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(lower)?.[1]
  if (v4Tail !== undefined) return isPrivateV4(v4Tail)
  if (lower.startsWith('::ffff:')) return true // v4-mapped in hex form
  const firstGroup = Number.parseInt(lower.split(':')[0] || '0', 16)
  if ((firstGroup & 0xfe00) === 0xfc00) return true // fc00::/7 unique-local
  if ((firstGroup & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if (firstGroup === 0x64 && lower.startsWith('64:ff9b')) return true // NAT64
  return false
}

/** Pre-check for URLs whose host is a literal IP (or localhost) — those skip
 * DNS entirely, so the connect-time guard never sees them. */
export function urlTargetsPrivate(rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return true
  }
  const host = url.hostname.replace(/^\[|\]$/g, '') // v6 brackets
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (isIP(host) !== 0) return isPrivateAddress(host)
  return false // a real hostname — the guarded lookup takes it from here
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void

/** dns.lookup wrapper that fails the connection when any resolved address is
 * private — same signature net.connect expects via undici's connect options. */
export function guardedLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  dnsLookup(
    hostname,
    options as never,
    ((err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => {
      if (err !== null) {
        callback(err, address, family)
        return
      }
      const addresses = Array.isArray(address) ? address.map((entry) => entry.address) : [address]
      const blocked = addresses.find((candidate) => isPrivateAddress(candidate))
      if (blocked !== undefined) {
        const error: NodeJS.ErrnoException = new Error(
          `webhook egress blocked: ${hostname} resolves to a private address (set WEBHOOK_ALLOW_PRIVATE=true to allow)`,
        )
        error.code = 'EEGRESSBLOCKED'
        callback(error, address, family)
        return
      }
      callback(null, address, family)
    }) as never,
  )
}

export interface EgressGuard {
  /** Pass to undici fetch — enforces the block at connect time. */
  dispatcher: Agent
  /** Fast fail for literal-IP / localhost URLs (they bypass DNS). */
  urlBlocked: (url: string) => boolean
}

export function createEgressGuard(allowPrivate: boolean): EgressGuard {
  return {
    dispatcher: new Agent(allowPrivate ? {} : { connect: { lookup: guardedLookup as never } }),
    urlBlocked: (url: string) => (allowPrivate ? false : urlTargetsPrivate(url)),
  }
}
