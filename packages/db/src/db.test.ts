// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormDefinition } from '@formsmithapp/engine'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from './client'
import { formsRepository } from './repositories/forms'
import { responsesRepository } from './repositories/responses'
import { createWorkspaceWithOwner, workspaceForUser } from './repositories/workspaces'
import { createTestDb, createTestUser } from './testing/harness'

const doc = (title = 'Test form'): FormDefinition => ({
  id: 'seed',
  title,
  blocks: [
    { id: 'b1', ref: 'welcome', type: 'welcome', title: 'Hi', required: false },
    { id: 'b2', ref: 'name', type: 'short_text', title: 'Name?', required: true },
    { id: 'b3', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
  ],
  logic: [],
  variables: [],
  settings: {},
})

let db: Database
let wsA: { id: string }
let wsB: { id: string }

beforeEach(async () => {
  db = await createTestDb()
  const alice = await createTestUser(db, 'alice')
  const bob = await createTestUser(db, 'bob')
  wsA = await createWorkspaceWithOwner(db, alice, "Alice's workspace")
  wsB = await createWorkspaceWithOwner(db, bob, "Bob's workspace")
})

describe('workspaces', () => {
  it('bootstrap creates workspace + owner membership atomically', async () => {
    const found = await workspaceForUser(db, 'alice')
    expect(found).toMatchObject({ id: wsA.id, name: "Alice's workspace", role: 'owner' })
    expect(await workspaceForUser(db, 'nobody')).toBeNull()
  })
})

describe('forms repository (workspace-scoped)', () => {
  it('create rewrites the doc id to the row id; round-trips', async () => {
    const repo = formsRepository(db)
    const created = await repo.create(wsA.id, doc())
    expect(created.doc.id).toBe(created.id) // server-authoritative id
    const fetched = await repo.get(wsA.id, created.id)
    expect(fetched?.doc.blocks).toHaveLength(3)
    expect((await repo.list(wsA.id)).map((f) => f.id)).toEqual([created.id])
  })

  it('TENANT ISOLATION: another workspace sees nothing, touches nothing', async () => {
    const repo = formsRepository(db)
    const created = await repo.create(wsA.id, doc())
    expect(await repo.get(wsB.id, created.id)).toBeNull()
    expect(await repo.list(wsB.id)).toEqual([])
    expect(await repo.save(wsB.id, created.id, doc('hijacked'))).toBe(false)
    expect(await repo.publish(wsB.id, created.id)).toBeNull()
    expect(await repo.remove(wsB.id, created.id)).toBe(false)
    // the original is untouched
    expect((await repo.get(wsA.id, created.id))?.title).toBe('Test form')
  })

  it('publish bumps the version and snapshots immutably', async () => {
    const repo = formsRepository(db)
    const created = await repo.create(wsA.id, doc('Original'))
    expect(await repo.publish(wsA.id, created.id)).toEqual({ version: 1 })

    await repo.save(wsA.id, created.id, { ...created.doc, title: 'Edited after publish' })
    expect(await repo.publish(wsA.id, created.id)).toEqual({ version: 2 })

    const v1 = await repo.getSnapshot(wsA.id, created.id, 1)
    const v2 = await repo.getSnapshot(wsA.id, created.id, 2)
    expect(v1?.title).toBe('Original')
    expect(v2?.title).toBe('Edited after publish')
    expect(await repo.getSnapshot(wsB.id, created.id, 1)).toBeNull() // scoped

    // the public serve path returns the LATEST published snapshot, unscoped
    expect((await repo.getPublicSnapshot(created.id))?.title).toBe('Edited after publish')
    expect(await repo.getPublicSnapshot(crypto.randomUUID())).toBeNull()
  })

  it('duplicate copies the doc as a fresh draft', async () => {
    const repo = formsRepository(db)
    const created = await repo.create(wsA.id, doc())
    await repo.publish(wsA.id, created.id)
    const copy = await repo.duplicate(wsA.id, created.id)
    expect(copy?.title).toBe('Test form (copy)')
    expect(copy?.status).toBe('draft')
    expect(copy?.publishedVersion).toBeNull()
    expect(copy?.doc.id).toBe(copy?.id)
  })

  it('remove cascades versions and responses', async () => {
    const formsRepo = formsRepository(db)
    const responsesRepo = responsesRepository(db)
    const created = await formsRepo.create(wsA.id, doc())
    await formsRepo.publish(wsA.id, created.id)
    await responsesRepo.insert({
      formId: created.id,
      formVersion: 1,
      answers: { name: 'Ada' },
      variables: {},
      hidden: {},
      ending: 'thanks',
    })
    expect(await formsRepo.remove(wsA.id, created.id)).toBe(true)
    expect(await responsesRepo.list(wsA.id, created.id)).toEqual([])
    expect(await formsRepo.getSnapshot(wsA.id, created.id, 1)).toBeNull()
  })
})

describe('responses repository', () => {
  it('lists newest-first, workspace-scoped; remove respects scoping', async () => {
    const formsRepo = formsRepository(db)
    const repo = responsesRepository(db)
    const created = await formsRepo.create(wsA.id, doc())
    await formsRepo.publish(wsA.id, created.id)

    const base = {
      formId: created.id,
      formVersion: 1,
      variables: {},
      hidden: {},
      ending: 'thanks',
    }
    const first = await repo.insert({ ...base, answers: { name: 'Ada' } })
    // force distinct timestamps (defaultNow has ms precision; PGlite is fast)
    await db
      .insert((await import('./schema')).responses)
      .values({ ...base, answers: { name: 'Grace' }, submittedAt: new Date(Date.now() + 1000) })

    const list = await repo.list(wsA.id, created.id)
    expect(list).toHaveLength(2)
    expect(list[0]?.answers).toEqual({ name: 'Grace' }) // newest first
    expect(await repo.list(wsB.id, created.id)).toEqual([]) // scoped

    expect(await repo.remove(wsB.id, created.id, first.id)).toBe(false) // scoped
    expect(await repo.remove(wsA.id, created.id, first.id)).toBe(true)
    expect((await repo.list(wsA.id, created.id)).map((r) => r.id)).not.toContain(first.id)
  })
})
