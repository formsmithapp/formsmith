// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormDefinition } from '@formsmithapp/engine'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Database } from './client'
import { apiKeysRepository, webhooksRepository } from './repositories/connect'
import { creditsRepository } from './repositories/credits'
import { formsRepository } from './repositories/forms'
import { responsesRepository } from './repositories/responses'
import { createWorkspaceWithOwner, workspaceForUser } from './repositories/workspaces'
import { forms as formsTable, workspaces as workspacesTable } from './schema'
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
    expect((await responsesRepo.list(wsA.id, created.id)).responses).toEqual([])
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
    expect(list.responses).toHaveLength(2)
    expect(list.responses[0]?.answers).toEqual({ name: 'Grace' }) // newest first
    expect((await repo.list(wsB.id, created.id)).responses).toEqual([]) // scoped

    expect(await repo.remove(wsB.id, created.id, first.id)).toBe(false) // scoped
    expect(await repo.remove(wsA.id, created.id, first.id)).toBe(true)
    expect((await repo.list(wsA.id, created.id)).responses.map((r) => r.id)).not.toContain(first.id)
  })

  it('keyset-paginates newest-first, no overlap or gaps, clamps the limit', async () => {
    const formsRepo = formsRepository(db)
    const repo = responsesRepository(db)
    const created = await formsRepo.create(wsA.id, doc())
    await formsRepo.publish(wsA.id, created.id)

    const schema = (await import('./schema')).responses
    // strictly increasing timestamps → a deterministic newest-first order
    const base = Date.now()
    const ids: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const [row] = await db
        .insert(schema)
        .values({
          formId: created.id,
          formVersion: 1,
          answers: { name: `r${i}` },
          variables: {},
          hidden: {},
          ending: 'thanks',
          submittedAt: new Date(base + i * 1000),
        })
        .returning()
      if (row !== undefined) ids.push(row.id)
    }
    const newestFirst = [...ids].reverse() // inserted oldest→newest, listed newest→oldest

    const page1 = await repo.list(wsA.id, created.id, { limit: 2 })
    expect(page1.responses.map((r) => r.id)).toEqual(newestFirst.slice(0, 2))
    expect(page1.nextCursor).not.toBeNull()

    const page2 = await repo.list(wsA.id, created.id, {
      limit: 2,
      cursor: page1.nextCursor ?? undefined,
    })
    expect(page2.responses.map((r) => r.id)).toEqual(newestFirst.slice(2, 4))

    const page3 = await repo.list(wsA.id, created.id, {
      limit: 2,
      cursor: page2.nextCursor ?? undefined,
    })
    expect(page3.responses.map((r) => r.id)).toEqual(newestFirst.slice(4))
    expect(page3.nextCursor).toBeNull()

    // limit clamps to [1, 200]; a garbage cursor falls back to the first page
    expect((await repo.list(wsA.id, created.id, { limit: 9999 })).responses).toHaveLength(5)
    expect((await repo.list(wsA.id, created.id, { limit: 0 })).responses).toHaveLength(1)
    expect(
      (await repo.list(wsA.id, created.id, { cursor: 'not-a-cursor' })).responses,
    ).toHaveLength(5)
  })

  it('walk() streams every row in newest-first batches', async () => {
    const formsRepo = formsRepository(db)
    const repo = responsesRepository(db)
    const created = await formsRepo.create(wsA.id, doc())
    await formsRepo.publish(wsA.id, created.id)

    const schema = (await import('./schema')).responses
    const base = Date.now()
    for (let i = 0; i < 7; i += 1) {
      await db.insert(schema).values({
        formId: created.id,
        formVersion: 1,
        answers: { name: `r${i}` },
        variables: {},
        hidden: {},
        ending: 'thanks',
        submittedAt: new Date(base + i * 1000),
      })
    }

    const seen: string[] = []
    for await (const batch of repo.walk(wsA.id, created.id, 3)) {
      seen.push(...batch.map((r) => r.answers.name as string))
    }
    expect(seen).toEqual(['r6', 'r5', 'r4', 'r3', 'r2', 'r1', 'r0'])
  })
})

describe('credits + quotas (v0.1.5)', () => {
  it('AI credits: lazy grant on first charge, atomic decrement, exhaustion', async () => {
    const credits = creditsRepository(db)
    // first charge ensures the row at the grant (3), then spends 1
    expect(await credits.charge(wsA.id, 1, 3)).toBe(2)
    expect(await credits.charge(wsA.id, 1, 3)).toBe(1) // grant ignored once the row exists
    expect(await credits.charge(wsA.id, 1, 3)).toBe(0)
    expect(await credits.charge(wsA.id, 1, 3)).toBeNull() // exhausted: 0 < 1, nothing spent
    expect(await credits.get(wsA.id)).toEqual({ remaining: 0, granted: 3 })

    // a cost larger than the balance spends nothing (the row is still ensured)
    expect(await credits.charge(wsB.id, 5, 3)).toBeNull()
    expect(await credits.get(wsB.id)).toEqual({ remaining: 3, granted: 3 })

    // no ledger row → null (the unlimited path never calls charge)
    const fresh = await createWorkspaceWithOwner(db, await createTestUser(db, 'cara'), 'Cara')
    expect(await credits.get(fresh.id)).toBeNull()
  })

  it('monthly response cap: upsert-increment, reject + roll back over cap', async () => {
    const formsRepo = formsRepository(db)
    const repo = responsesRepository(db)
    const created = await formsRepo.create(wsA.id, doc())
    await formsRepo.publish(wsA.id, created.id)
    const base = { formId: created.id, formVersion: 1, variables: {}, hidden: {}, ending: null }
    const month = '2026-07'

    expect(
      (await repo.insertMetered({ ...base, answers: { n: 1 } }, { monthlyCap: 2, month })).ok,
    ).toBe(true)
    expect(
      (await repo.insertMetered({ ...base, answers: { n: 2 } }, { monthlyCap: 2, month })).ok,
    ).toBe(true)
    const third = await repo.insertMetered({ ...base, answers: { n: 3 } }, { monthlyCap: 2, month })
    expect(third.ok).toBe(false)
    // exactly 2 stored — the 3rd rolled back, and the counter did not advance
    expect((await repo.list(wsA.id, created.id)).responses).toHaveLength(2)

    // a fresh month starts the count over
    expect(
      (
        await repo.insertMetered(
          { ...base, answers: { n: 4 } },
          { monthlyCap: 2, month: '2026-08' },
        )
      ).ok,
    ).toBe(true)
    // null cap = unlimited plain insert
    expect(
      (await repo.insertMetered({ ...base, answers: { n: 5 } }, { monthlyCap: null, month })).ok,
    ).toBe(true)
    expect((await repo.list(wsA.id, created.id)).responses).toHaveLength(4)
  })

  it('count helpers back the create-time quotas', async () => {
    const formsRepo = formsRepository(db)
    expect(await formsRepo.count(wsA.id)).toBe(0)
    const f = await formsRepo.create(wsA.id, doc())
    expect(await formsRepo.count(wsA.id)).toBe(1)
    expect(await formsRepo.count(wsB.id)).toBe(0) // scoped
    expect(await formsRepo.workspaceOf(f.id)).toBe(wsA.id)
    expect(await formsRepo.workspaceOf(crypto.randomUUID())).toBeNull()
    expect(await webhooksRepository(db).count(f.id)).toBe(0)
    expect(await apiKeysRepository(db).count(wsA.id)).toBe(0)
  })
})

describe('abuse kill switch (v0.1.5)', () => {
  it('a suspended form or workspace stops serving; isSuspended reflects both', async () => {
    const repo = formsRepository(db)
    const created = await repo.create(wsA.id, doc())
    await repo.publish(wsA.id, created.id)

    // servable by default
    expect(await repo.getPublicSnapshot(created.id)).not.toBeNull()
    expect(await repo.isSuspended(created.id)).toBe(false)

    // suspend the FORM → stops serving
    await db.update(formsTable).set({ suspended: true }).where(eq(formsTable.id, created.id))
    expect(await repo.getPublicSnapshot(created.id)).toBeNull()
    expect(await repo.isSuspended(created.id)).toBe(true)

    // un-suspend the form but suspend the WORKSPACE → still stops serving
    await db.update(formsTable).set({ suspended: false }).where(eq(formsTable.id, created.id))
    await db.update(workspacesTable).set({ suspended: true }).where(eq(workspacesTable.id, wsA.id))
    expect(await repo.getPublicSnapshot(created.id)).toBeNull()
    expect(await repo.isSuspended(created.id)).toBe(true)
  })
})
