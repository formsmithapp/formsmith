// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { createWorkspaceWithOwner, type Database, schema } from '@formsmithapp/db'
import type { FormDefinition } from '@formsmithapp/engine'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeEach, describe, expect, it } from 'vitest'
import { createApi } from './index'

const require = createRequire(import.meta.url)

async function testDb(): Promise<Database> {
  const db = drizzle(new PGlite(), { schema })
  const migrations = join(dirname(require.resolve('@formsmithapp/db/package.json')), 'drizzle')
  await migrate(db, { migrationsFolder: migrations })
  return db as unknown as Database
}

const quizDoc = (): FormDefinition => ({
  id: 'seed',
  title: 'Plan quiz',
  blocks: [
    { id: 'b_w', ref: 'welcome', type: 'welcome', title: 'Hi', required: false },
    {
      id: 'b_plan',
      ref: 'plan',
      type: 'multiple_choice',
      title: 'Pick a plan',
      required: true,
      properties: {
        choices: [
          { id: 'starter', label: 'Starter' },
          { id: 'pro', label: 'Pro' },
        ],
      },
    },
    { id: 'b_end', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
  ],
  logic: [
    {
      id: 'r_score',
      kind: 'calculation',
      owner: { type: 'block', ref: 'b_plan' },
      expr: { '==': [{ var: 'plan' }, 'pro'] },
      action: { variable: 'score', op: 'add', value: 10 },
    },
  ],
  variables: [{ name: 'score', type: 'number' }],
  settings: {},
})

let db: Database
let currentUser: string | null
let app: ReturnType<typeof createApi>

const json = (body: unknown) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

async function createForm(): Promise<string> {
  const res = await app.request('/api/v1/forms', json({ doc: quizDoc() }))
  expect(res.status).toBe(201)
  const body = (await res.json()) as { form: FormDefinition }
  return body.form.id
}

beforeEach(async () => {
  db = await testDb()
  await db.insert(schema.user).values([
    { id: 'alice', name: 'Alice', email: 'alice@example.test' },
    { id: 'mallory', name: 'Mallory', email: 'mallory@example.test' },
  ])
  await createWorkspaceWithOwner(db, 'alice', "Alice's workspace")
  await createWorkspaceWithOwner(db, 'mallory', "Mallory's workspace")
  currentUser = 'alice'
  app = createApi({
    db,
    getSession: async () => (currentUser === null ? null : { userId: currentUser }),
  })
})

describe('auth & tenancy', () => {
  it('anonymous requests to the dashboard surface get 401', async () => {
    currentUser = null
    expect((await app.request('/api/v1/forms')).status).toBe(401)
    expect((await app.request('/api/v1/forms', json({ doc: quizDoc() }))).status).toBe(401)
  })

  it("another workspace's forms are invisible and untouchable (404s)", async () => {
    const id = await createForm()
    currentUser = 'mallory'
    expect((await app.request(`/api/v1/forms/${id}`)).status).toBe(404)
    expect((await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })).status).toBe(404)
    expect((await app.request(`/api/v1/forms/${id}`, { method: 'DELETE' })).status).toBe(404)
    const list = (await (await app.request('/api/v1/forms')).json()) as { forms: unknown[] }
    expect(list.forms).toEqual([])
  })

  it('garbage ids 404 instead of exploding the uuid column', async () => {
    expect((await app.request('/api/v1/forms/not-a-uuid')).status).toBe(404)
    expect((await app.request('/api/v1/f/not-a-uuid')).status).toBe(404)
  })
})

describe('forms lifecycle', () => {
  it('create → list summary → save → publish → snapshot', async () => {
    const id = await createForm()
    const list = (await (await app.request('/api/v1/forms')).json()) as {
      forms: { id: string; blockCount: number; status: string }[]
    }
    expect(list.forms[0]).toMatchObject({ id, blockCount: 3, status: 'draft' })

    const publish = await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })
    expect(await publish.json()).toEqual({ version: 1 })

    const save = await app.request(`/api/v1/forms/${id}`, {
      ...json({ doc: { ...quizDoc(), id, title: 'Edited' } }),
      method: 'PUT',
    })
    expect(save.status).toBe(200)

    const snapshot = (await (await app.request(`/api/v1/forms/${id}/versions/1`)).json()) as {
      form: FormDefinition
    }
    expect(snapshot.form.title).toBe('Plan quiz') // immutable — the edit stayed in the draft
  })

  it('publish gates on the SERVER: invalid doc → 422 with issues', async () => {
    const broken = quizDoc()
    const plan = broken.blocks[1]
    if (plan?.properties !== undefined) plan.properties = { choices: [] } // schema requires ≥1
    const res = await app.request('/api/v1/forms', json({ doc: broken }))
    const { form } = (await res.json()) as { form: FormDefinition }
    const publish = await app.request(`/api/v1/forms/${form.id}/publish`, { method: 'POST' })
    expect(publish.status).toBe(422)
    const body = (await publish.json()) as { issues: string[] }
    expect(body.issues.length).toBeGreaterThan(0)
  })
})

describe('the public surface', () => {
  it('serves the latest published snapshot without a session; drafts 404', async () => {
    const id = await createForm()
    expect((await app.request(`/api/v1/f/${id}`)).status).toBe(404) // draft

    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })
    currentUser = null // respondent
    const res = await app.request(`/api/v1/f/${id}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('max-age=60')
    const body = (await res.json()) as { form: FormDefinition }
    expect(body.form.version).toBe(1)
  })

  it('submit re-evaluates: stores recomputed variables, rejects tampering', async () => {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    currentUser = null // respondent
    const ok = await app.request(`/api/v1/f/${id}/responses`, json({ answers: { plan: 'pro' } }))
    expect(ok.status).toBe(201)

    const tampered = await app.request(
      `/api/v1/f/${id}/responses`,
      json({ answers: { plan: 'starter' }, variables: { score: 999 } }),
    )
    expect(tampered.status).toBe(422)
    const body = (await tampered.json()) as { issues: { code: string }[] }
    expect(body.issues[0]?.code).toBe('variable_mismatch')

    const skipped = await app.request(`/api/v1/f/${id}/responses`, json({ answers: {} }))
    expect(skipped.status).toBe(422)

    currentUser = 'alice' // back in the dashboard: one stored response, score recomputed
    const list = (await (await app.request(`/api/v1/forms/${id}/responses`)).json()) as {
      responses: { variables: Record<string, unknown> }[]
    }
    expect(list.responses).toHaveLength(1)
    expect(list.responses[0]?.variables).toEqual({ score: 10 })
  })
})

describe('import', () => {
  it('imports forms with their snapshots; echoes the source ids', async () => {
    const res = await app.request(
      '/api/v1/import',
      json({
        forms: [
          {
            sourceId: 'local-1',
            doc: quizDoc(),
            status: 'published',
            publishedVersion: 1,
            versions: [{ version: 1, doc: { ...quizDoc(), version: 1 } }],
          },
        ],
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { imported: { sourceId: string; id: string }[] }
    expect(body.imported[0]?.sourceId).toBe('local-1')
    const newId = body.imported[0]?.id ?? ''

    // the imported snapshot serves publicly — old links keep working post-migration
    currentUser = null
    expect((await app.request(`/api/v1/f/${newId}`)).status).toBe(200)
  })
})
