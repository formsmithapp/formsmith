// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * In-memory sliding-window rate limiter — honest for the single-container v1
 * build (no Redis, keeps the two-container promise). Swaps for a shared
 * store at hosted scale. The AI endpoint ships with this IN S4: an
 * unguarded endpoint that spends the operator's LLM budget can't wait for
 * the S5 hardening pass.
 */

export interface RateLimiter {
  /** True = allowed; false = over the limit. */
  allow(key: string): boolean
}

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const hits = new Map<string, number[]>()
  let sweepCounter = 0

  return {
    allow(key: string): boolean {
      const now = Date.now()
      const cutoff = now - options.windowMs
      const entries = (hits.get(key) ?? []).filter((t) => t > cutoff)
      if (entries.length >= options.max) {
        hits.set(key, entries)
        return false
      }
      entries.push(now)
      hits.set(key, entries)
      // occasional sweep so abandoned keys don't accumulate forever
      if (++sweepCounter % 500 === 0) {
        for (const [k, v] of hits) {
          const alive = v.filter((t) => t > cutoff)
          if (alive.length === 0) hits.delete(k)
          else hits.set(k, alive)
        }
      }
      return true
    },
  }
}
