// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `CacheAdapter` — the serializable-value cache boundary. v1 ships
 * {@link InMemoryLruCache}; a Redis implementation slots in behind the SAME
 * interface later, which is why the semantics are Redis-shaped from day one:
 * async everywhere, JSON-serializable values only, mandatory TTLs, and an
 * atomic fixed-window counter for rate limiting (INCR + NX EXPIRE).
 *
 * CONTRACT — fail-open: the cache is an accelerator, never a dependency.
 * Implementation errors must surface as misses/no-ops (wrap remote-backed
 * implementations with {@link safeCache}), never as thrown request failures.
 *
 * NOT for live objects: compiled engines, class instances, and functions can't
 * cross a serialization boundary — keep those in plain in-process memos.
 */
export interface CacheAdapter {
  /** null on miss or expiry. */
  get<T>(key: string): Promise<T | null>
  /** `value` must be JSON-serializable; every entry expires. */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  /**
   * Atomic fixed-window counter: increments and returns the count. The key
   * expires `ttlSeconds` after its FIRST increment in the current window.
   */
  incr(key: string, ttlSeconds: number): Promise<number>
}

interface Entry {
  /** Values are stored SERIALIZED — same isolation semantics as Redis
   * (mutating what `get` returned never poisons the cache). */
  json: string
  expiresAt: number
}

const SWEEP_INTERVAL_MS = 60_000

/**
 * Bounded LRU over a Map (its iteration order is insertion order; re-inserting
 * on `get` makes the first key the least recently used). Expiry is lazy on
 * read plus a periodic sweep so short-lived keys don't linger to the bound.
 */
export class InMemoryLruCache implements CacheAdapter {
  private readonly entries = new Map<string, Entry>()
  private readonly counters = new Map<string, { count: number; expiresAt: number }>()
  private lastSweep = Date.now()

  constructor(private readonly maxItems = 500) {}

  async get<T>(key: string): Promise<T | null> {
    this.maybeSweep()
    const entry = this.entries.get(key)
    if (entry === undefined) return null
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key)
      return null
    }
    // refresh recency
    this.entries.delete(key)
    this.entries.set(key, entry)
    return JSON.parse(entry.json) as T
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.maybeSweep()
    const json = JSON.stringify(value)
    if (json === undefined) throw new Error(`cache value for "${key}" is not JSON-serializable`)
    this.entries.delete(key)
    this.entries.set(key, { json, expiresAt: Date.now() + ttlSeconds * 1_000 })
    if (this.entries.size > this.maxItems) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key)
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    this.maybeSweep()
    const now = Date.now()
    const counter = this.counters.get(key)
    if (counter === undefined || counter.expiresAt <= now) {
      this.counters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1_000 })
      return 1
    }
    counter.count += 1
    return counter.count
  }

  private maybeSweep(): void {
    const now = Date.now()
    if (now - this.lastSweep < SWEEP_INTERVAL_MS) return
    this.lastSweep = now
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key)
    }
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(key)
    }
  }
}

/**
 * The fail-open wrapper: errors become misses/no-ops; a failing `incr`
 * reports count 1 (= allow) because rate limiting degrades open, not closed.
 */
export function safeCache(cache: CacheAdapter): CacheAdapter {
  return {
    async get<T>(key: string): Promise<T | null> {
      try {
        return await cache.get<T>(key)
      } catch {
        return null
      }
    },
    async set(key, value, ttlSeconds) {
      try {
        await cache.set(key, value, ttlSeconds)
      } catch {
        /* fail open */
      }
    },
    async delete(key) {
      try {
        await cache.delete(key)
      } catch {
        /* fail open */
      }
    },
    async incr(key, ttlSeconds) {
      try {
        return await cache.incr(key, ttlSeconds)
      } catch {
        return 1
      }
    },
  }
}
