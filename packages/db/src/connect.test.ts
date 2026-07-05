// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormDefinition } from '@formsmithapp/engine'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from './client'
import { apiKeysRepository, webhooksRepository } from './repositories/connect'
import { formsRepository } from './repositories/forms'
import { createWorkspaceWithOwner } from './repositories/workspaces'
import { createTestDb, createTestUser } from './testing/harness'

const doc = (): FormDefinition => ({
  id: 'seed',
  title: 'Hook target',
  blocks: [
    { id: 'b1', ref: 'welcome', type: 'welcome', title: 'Hi', required: false },
    { id: 'b2', ref: 'name', type: 'short_text', title: 'Name?', required: false },
    { id: 'b3', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
  ],
})

let db: Database
let wsA: { id: string }
let wsB: { id: string }
let formA: string

beforeEach(async () => {
  db = await createTestDb()
  wsA = await createWorkspaceWithOwner(db, await createTestUser(db, 'alice'), 'A')
  wsB = await createWorkspaceWithOwner(db, await createTestUser(db, 'bob'), 'B')
  formA = (await formsRepository(db).create(wsA.id, doc())).id
})

describe('api keys', () => {
  it('creates, lists active-only, revokes (audit row survives)', async () => {
    const repo = apiKeysRepository(db)
    const key = await repo.create(wsA.id, 'CI key', { keyHash: 'hash-1', prefix: 'fsk_abc123' })
    expect((await repo.list(wsA.id)).map((k) => k.id)).toEqual([key.id])
    expect(await repo.list(wsB.id)).toEqual([]) // scoped

    expect(await repo.revoke(wsB.id, key.id)).toBe(false) // scoped
    expect(await repo.revoke(wsA.id, key.id)).toBe(true)
    expect(await repo.revoke(wsA.id, key.id)).toBe(false) // idempotent-ish: already revoked
    expect(await repo.list(wsA.id)).toEqual([]) // revoked keys leave the list
    expect(await repo.findByHash('hash-1')).toBeNull() // and stop authenticating
  })

  it('findByHash resolves the workspace for active keys', async () => {
    const repo = apiKeysRepository(db)
    await repo.create(wsA.id, 'k', { keyHash: 'hash-2', prefix: 'fsk_def456' })
    expect(await repo.findByHash('hash-2')).toMatchObject({ workspaceId: wsA.id })
    expect(await repo.findByHash('nope')).toBeNull()
  })

  it('usage buckets upsert-increment and read back scoped + since-bounded', async () => {
    const repo = apiKeysRepository(db)
    const key = await repo.create(wsA.id, 'k', { keyHash: 'hash-3', prefix: 'fsk_ghi789' })
    await repo.recordUsage(key.id, '2026-07-05')
    await repo.recordUsage(key.id, '2026-07-06')
    await repo.recordUsage(key.id, '2026-07-06')
    expect(await repo.usage(wsA.id, key.id, '2026-07-01')).toEqual([
      { day: '2026-07-05', requests: 1 },
      { day: '2026-07-06', requests: 2 },
    ])
    expect(await repo.usage(wsA.id, key.id, '2026-07-06')).toHaveLength(1) // since bound
    expect(await repo.usage(wsB.id, key.id, '2026-07-01')).toEqual([]) // scoped
  })

  it('touchLastUsed throttles to once a minute', async () => {
    const repo = apiKeysRepository(db)
    const key = await repo.create(wsA.id, 'k', { keyHash: 'hash-4', prefix: 'fsk_jkl012' })
    await repo.touchLastUsed(key.id)
    const [first] = await repo.list(wsA.id)
    expect(first?.lastUsedAt).not.toBeNull()
    await repo.touchLastUsed(key.id) // within the minute — no write
    const [second] = await repo.list(wsA.id)
    expect(second?.lastUsedAt?.getTime()).toBe(first?.lastUsedAt?.getTime())
  })
})

describe('webhooks', () => {
  it('creates only on owned forms; lists and removes scoped', async () => {
    const repo = webhooksRepository(db)
    expect(await repo.create(wsB.id, formA, 'https://x.test/hook', 's')).toBeNull() // not Bob's
    const hook = await repo.create(wsA.id, formA, 'https://x.test/hook', 's')
    expect(hook).not.toBeNull()
    expect((await repo.list(wsA.id, formA)).map((w) => w.id)).toEqual([hook?.id])
    expect(await repo.list(wsB.id, formA)).toEqual([])
    expect(await repo.remove(wsB.id, formA, hook?.id ?? '')).toBe(false)
    expect(await repo.remove(wsA.id, formA, hook?.id ?? '')).toBe(true)
  })

  it('recordAttempt writes history AND the at-a-glance state; deliveries read scoped', async () => {
    const repo = webhooksRepository(db)
    const hook = await repo.create(wsA.id, formA, 'https://x.test/hook', 's')
    if (hook === null) throw new Error('fixture')
    await repo.recordAttempt(hook.id, {
      event: 'response.created',
      attempt: 1,
      status: 500,
      error: 'server exploded',
      durationMs: 120,
    })
    await repo.recordAttempt(hook.id, {
      event: 'response.created',
      attempt: 2,
      status: 200,
      error: null,
      durationMs: 80,
    })

    const [updated] = await repo.list(wsA.id, formA)
    expect(updated).toMatchObject({ lastStatus: 200, lastError: null })

    const history = await repo.deliveries(wsA.id, formA, hook.id)
    expect(history).toHaveLength(2)
    expect(history[0]?.attempt).toBe(2) // newest first
    expect(await repo.deliveries(wsB.id, formA, hook.id)).toEqual([]) // scoped
  })

  it('listActiveByForm skips inactive; prune deletes old rows only', async () => {
    const repo = webhooksRepository(db)
    const hook = await repo.create(wsA.id, formA, 'https://x.test/hook', 's')
    if (hook === null) throw new Error('fixture')
    expect(await repo.listActiveByForm(formA)).toHaveLength(1)

    await repo.recordAttempt(hook.id, {
      event: 'ping',
      attempt: 1,
      status: 200,
      error: null,
      durationMs: 10,
    })
    expect(await repo.pruneDeliveries(30)).toBe(0) // fresh rows survive
    expect(await repo.pruneDeliveries(0)).toBe(1) // everything older than "now"
  })
})
