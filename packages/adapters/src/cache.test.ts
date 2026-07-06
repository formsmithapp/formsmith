// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type CacheAdapter, InMemoryLruCache, safeCache } from './cache'

describe('InMemoryLruCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('round-trips JSON values and isolates them (Redis semantics)', async () => {
    const cache = new InMemoryLruCache()
    const value = { doc: { title: 'Quiz' }, version: 1 }
    await cache.set('fs:snapshot:x:1', value, 60)
    const first = await cache.get<typeof value>('fs:snapshot:x:1')
    expect(first).toEqual(value)
    expect(first).not.toBe(value) // stored serialized, not by reference
    // mutating what get returned must not poison the cache
    if (first !== null) first.doc.title = 'MUTATED'
    expect(await cache.get<typeof value>('fs:snapshot:x:1')).toEqual(value)
  })

  it('expires entries after their TTL', async () => {
    const cache = new InMemoryLruCache()
    await cache.set('k', 'v', 30)
    vi.advanceTimersByTime(29_000)
    expect(await cache.get('k')).toBe('v')
    vi.advanceTimersByTime(2_000)
    expect(await cache.get('k')).toBeNull()
  })

  it('evicts the LEAST RECENTLY USED entry at the bound', async () => {
    const cache = new InMemoryLruCache(2)
    await cache.set('a', 1, 60)
    await cache.set('b', 2, 60)
    await cache.get('a') // refresh a — b is now the LRU
    await cache.set('c', 3, 60)
    expect(await cache.get('a')).toBe(1)
    expect(await cache.get('b')).toBeNull() // evicted
    expect(await cache.get('c')).toBe(3)
  })

  it('incr counts within a fixed window and resets after it', async () => {
    const cache = new InMemoryLruCache()
    expect(await cache.incr('rl:k', 60)).toBe(1)
    expect(await cache.incr('rl:k', 60)).toBe(2)
    expect(await cache.incr('rl:k', 60)).toBe(3)
    // the window is fixed from the FIRST increment — not sliding
    vi.advanceTimersByTime(59_000)
    expect(await cache.incr('rl:k', 60)).toBe(4)
    vi.advanceTimersByTime(2_000)
    expect(await cache.incr('rl:k', 60)).toBe(1) // new window
  })

  it('rejects unserializable values loudly', async () => {
    const cache = new InMemoryLruCache()
    await expect(cache.set('k', undefined, 60)).rejects.toThrow('not JSON-serializable')
  })
})

describe('safeCache (the fail-open contract)', () => {
  const broken: CacheAdapter = {
    get: async () => {
      throw new Error('redis down')
    },
    set: async () => {
      throw new Error('redis down')
    },
    delete: async () => {
      throw new Error('redis down')
    },
    incr: async () => {
      throw new Error('redis down')
    },
  }

  it('errors become misses/no-ops; a failing incr ALLOWS (count 1)', async () => {
    const cache = safeCache(broken)
    expect(await cache.get('k')).toBeNull()
    await expect(cache.set('k', 'v', 60)).resolves.toBeUndefined()
    await expect(cache.delete('k')).resolves.toBeUndefined()
    expect(await cache.incr('k', 60)).toBe(1) // rate limiting degrades OPEN
  })
})
