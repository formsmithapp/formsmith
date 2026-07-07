// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { InMemoryQueue } from '@formsmithapp/adapters'
import { createMockProvider } from '@formsmithapp/ai'
import {
  createWorkspaceWithOwner,
  creditsRepository,
  type Database,
  schema,
  workspaceForUser,
} from '@formsmithapp/db'
import type { FormDefinition } from '@formsmithapp/engine'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { beforeEach, describe, expect, it } from 'vitest'
import { type ApiDeps, createApi } from './index'

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
let currentVerified = true
let app: ReturnType<typeof createApi>
let queue: InMemoryQueue

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
  currentVerified = true
  queue = new InMemoryQueue()
  app = createApi({
    db,
    getSession: async () =>
      currentUser === null ? null : { userId: currentUser, emailVerified: currentVerified },
    queue,
    ai: { provider: createMockProvider() },
    signingSecret: 'test-signing-secret',
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

describe('responses: pagination, summary, export', () => {
  /** Publish `id` and submit `answers` as an anonymous respondent; returns the stored id. */
  async function submit(id: string, answers: Record<string, unknown>): Promise<string> {
    const prev = currentUser
    currentUser = null
    const res = await app.request(`/api/v1/f/${id}/responses`, json({ answers }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string }
    currentUser = prev
    return body.id
  }

  async function seed(count: number): Promise<{ id: string; ids: string[] }> {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })
    const ids: string[] = []
    for (let i = 0; i < count; i += 1) {
      ids.push(await submit(id, { plan: i % 2 === 0 ? 'pro' : 'starter' }))
    }
    return { id, ids }
  }

  it('keyset-paginates: pages tile the full set with no overlap or gaps', async () => {
    const { id, ids } = await seed(3)

    const page1 = (await (await app.request(`/api/v1/forms/${id}/responses?limit=2`)).json()) as {
      responses: { id: string }[]
      nextCursor: string | null
    }
    expect(page1.responses).toHaveLength(2)
    expect(page1.nextCursor).not.toBeNull()

    const page2 = (await (
      await app.request(
        `/api/v1/forms/${id}/responses?limit=2&cursor=${encodeURIComponent(page1.nextCursor ?? '')}`,
      )
    ).json()) as { responses: { id: string }[]; nextCursor: string | null }
    expect(page2.responses).toHaveLength(1)
    expect(page2.nextCursor).toBeNull()

    const seen = [...page1.responses, ...page2.responses].map((r) => r.id)
    expect(new Set(seen)).toEqual(new Set(ids)) // every id, exactly once
  })

  it('summary returns the total and per-question choice distribution', async () => {
    const { id } = await seed(3) // pro, starter, pro

    const summary = (await (await app.request(`/api/v1/forms/${id}/responses/summary`)).json()) as {
      total: number
      summary: {
        block: { ref: string }
        kind: string
        options?: { label: string; count: number }[]
      }[]
    }
    expect(summary.total).toBe(3)
    const plan = summary.summary.find((entry) => entry.block.ref === 'plan')
    expect(plan?.kind).toBe('choices')
    expect(plan?.options).toEqual([
      { label: 'Starter', count: 1 },
      { label: 'Pro', count: 2 },
    ])
  })

  it('summary on an unpublished form is empty, not a 404', async () => {
    const id = await createForm()
    const res = await app.request(`/api/v1/forms/${id}/responses/summary`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ total: 0, summary: [] })
  })

  it('streams a CSV export: header + one row per response', async () => {
    const { id } = await seed(3)
    const res = await app.request(`/api/v1/forms/${id}/responses/export?format=csv`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('.csv')
    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines[0]).toBe('plan,submitted_at,version') // sole answerable block
    expect(lines).toHaveLength(4) // header + 3 rows
  })

  it('streams a JSON export: a well-formed array of every response', async () => {
    const { id, ids } = await seed(3)
    const res = await app.request(`/api/v1/forms/${id}/responses/export?format=json`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const rows = (await res.json()) as { id: string }[]
    expect(rows).toHaveLength(3)
    expect(new Set(rows.map((r) => r.id))).toEqual(new Set(ids))
  })

  it("another workspace cannot read a form's summary, export, or response list (404)", async () => {
    const { id } = await seed(2)
    currentUser = 'mallory'
    expect((await app.request(`/api/v1/forms/${id}/responses/summary`)).status).toBe(404)
    expect((await app.request(`/api/v1/forms/${id}/responses/export`)).status).toBe(404)
    // v0.1.5: the list endpoint now 404s a foreign form too (was an empty 200),
    // so every responses path behaves the same. Full matrix in the authz suite.
    expect((await app.request(`/api/v1/forms/${id}/responses?limit=5`)).status).toBe(404)
  })
})

describe('cross-tenant authz proof (v0.1.5 E)', () => {
  // alice owns everything; mallory is a second workspace that must be walled off
  // from every authed endpoint, by session AND by API-key bearer.
  async function seedAliceResources() {
    currentUser = 'alice'
    const formId = await createForm()
    await app.request(`/api/v1/forms/${formId}/publish`, { method: 'POST' })

    currentUser = null // respondent
    const submit = await app.request(
      `/api/v1/f/${formId}/responses`,
      json({ answers: { plan: 'pro' } }),
    )
    const responseId = ((await submit.json()) as { id: string }).id

    currentUser = 'alice'
    const wh = await app.request(
      `/api/v1/forms/${formId}/webhooks`,
      json({ url: 'https://alice.test/hook' }),
    )
    const webhookId = ((await wh.json()) as { webhook: { id: string } }).webhook.id
    const ak = await app.request('/api/v1/api-keys', json({ name: 'alice key' }))
    const apiKeyId = ((await ak.json()) as { key: { id: string } }).key.id

    return { formId, responseId, webhookId, apiKeyId }
  }

  it('every authed endpoint 404s a foreign resource (session auth)', async () => {
    const { formId, responseId, webhookId, apiKeyId } = await seedAliceResources()
    currentUser = 'mallory'

    const attempts: Array<[string, RequestInit?]> = [
      [`/api/v1/forms/${formId}`],
      [`/api/v1/forms/${formId}`, { ...json({ doc: quizDoc() }), method: 'PUT' }],
      [`/api/v1/forms/${formId}`, { method: 'DELETE' }],
      [`/api/v1/forms/${formId}/publish`, { method: 'POST' }],
      [`/api/v1/forms/${formId}/duplicate`, { method: 'POST' }],
      [`/api/v1/forms/${formId}/versions/1`],
      [`/api/v1/forms/${formId}/responses`],
      [`/api/v1/forms/${formId}/responses/summary`],
      [`/api/v1/forms/${formId}/responses/export`],
      [`/api/v1/forms/${formId}/responses/${responseId}`],
      [`/api/v1/forms/${formId}/responses/${responseId}`, { method: 'DELETE' }],
      [`/api/v1/forms/${formId}/webhooks`],
      [`/api/v1/forms/${formId}/webhooks`, json({ url: 'https://mallory.test/hook' })],
      [`/api/v1/forms/${formId}/webhooks/${webhookId}`, { method: 'DELETE' }],
      [`/api/v1/forms/${formId}/webhooks/${webhookId}/test`, { method: 'POST' }],
      [`/api/v1/api-keys/${apiKeyId}`, { method: 'DELETE' }],
    ]

    for (const [path, init] of attempts) {
      const res = await app.request(path, init)
      expect(res.status, `${init?.method ?? 'GET'} ${path}`).toBe(404)
    }
  })

  it('an API key is confined to its own workspace (bearer auth)', async () => {
    const { formId } = await seedAliceResources()
    // mallory mints her own key, then aims it at alice's form with NO session
    currentUser = 'mallory'
    const mk = await app.request('/api/v1/api-keys', json({ name: 'mallory key' }))
    const secret = ((await mk.json()) as { secret: string }).secret

    currentUser = null // force the bearer path
    const bearer = { headers: { authorization: `Bearer ${secret}` } }
    for (const path of [
      `/api/v1/forms/${formId}`,
      `/api/v1/forms/${formId}/responses`,
      `/api/v1/forms/${formId}/responses/summary`,
      `/api/v1/forms/${formId}/responses/export`,
      `/api/v1/forms/${formId}/webhooks`,
    ]) {
      expect((await app.request(path, bearer)).status, path).toBe(404)
    }
    // sanity: the same key DOES reach mallory's own surface
    expect((await app.request('/api/v1/forms', bearer)).status).toBe(200)
  })

  it('the victim workspace is unchanged after the destructive attempts', async () => {
    const { formId, responseId, webhookId, apiKeyId } = await seedAliceResources()

    currentUser = 'mallory' // throw every delete/mutation at alice's ids
    await app.request(`/api/v1/forms/${formId}`, { method: 'DELETE' })
    await app.request(`/api/v1/forms/${formId}/responses/${responseId}`, { method: 'DELETE' })
    await app.request(`/api/v1/forms/${formId}/webhooks/${webhookId}`, { method: 'DELETE' })
    await app.request(`/api/v1/api-keys/${apiKeyId}`, { method: 'DELETE' })

    currentUser = 'alice' // everything is still there
    expect((await app.request(`/api/v1/forms/${formId}`)).status).toBe(200)
    const list = (await (await app.request(`/api/v1/forms/${formId}/responses`)).json()) as {
      responses: { id: string }[]
    }
    expect(list.responses.map((r) => r.id)).toContain(responseId)
    const whs = (await (await app.request(`/api/v1/forms/${formId}/webhooks`)).json()) as {
      webhooks: { id: string }[]
    }
    expect(whs.webhooks.map((w) => w.id)).toContain(webhookId)
    const keys = (await (await app.request('/api/v1/api-keys')).json()) as {
      keys: { id: string }[]
    }
    expect(keys.keys.map((k) => k.id)).toContain(apiKeyId)
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

describe('S3: api keys + bearer auth', () => {
  it('mints once-revealed keys; bearer auth works; usage buckets record; revoke → 401', async () => {
    const created = await app.request('/api/v1/api-keys', json({ name: 'CI key' }))
    expect(created.status).toBe(201)
    const { key, secret } = (await created.json()) as {
      key: { id: string; prefix: string }
      secret: string
    }
    expect(secret).toMatch(/^fsk_/)
    expect(key.prefix).toBe(secret.slice(0, 12))

    // list never contains the secret
    const list = (await (await app.request('/api/v1/api-keys')).json()) as {
      keys: { id: string; prefix: string }[]
    }
    expect(JSON.stringify(list)).not.toContain(secret)

    // bearer auth reaches a workspace route WITHOUT a session
    currentUser = null
    const bearer = { headers: { authorization: `Bearer ${secret}` } }
    const viaKey = await app.request('/api/v1/forms', bearer)
    expect(viaKey.status).toBe(200)
    await app.request('/api/v1/forms', bearer) // second request, same day bucket

    // usage recorded into today's bucket (fire-and-forget → settle first)
    await new Promise((resolve) => setTimeout(resolve, 25))
    currentUser = 'alice'
    const withUsage = (await (await app.request('/api/v1/api-keys')).json()) as {
      keys: { id: string; total: number; usage: { requests: number }[] }[]
    }
    expect(withUsage.keys[0]?.total).toBe(2)

    // key-management surface is session-only — a key cannot reach it
    currentUser = null
    expect((await app.request('/api/v1/api-keys', bearer)).status).toBe(401)

    // revoke kills the key
    currentUser = 'alice'
    const revoked = await app.request(`/api/v1/api-keys/${key.id}`, { method: 'DELETE' })
    expect(revoked.status).toBe(200)
    currentUser = null
    expect((await app.request('/api/v1/forms', bearer)).status).toBe(401)
  })

  it('garbage bearer tokens are rejected', async () => {
    currentUser = null
    const res = await app.request('/api/v1/forms', {
      headers: { authorization: 'Bearer fsk_definitely-not-a-key' },
    })
    expect(res.status).toBe(401)
  })
})

describe('S3: webhooks', () => {
  it('CRUD is workspace-scoped; secret revealed once; list carries state + history', async () => {
    const formId = await createForm()
    const created = await app.request(
      `/api/v1/forms/${formId}/webhooks`,
      json({ url: 'https://example.test/hook' }),
    )
    expect(created.status).toBe(201)
    const { webhook, secret } = (await created.json()) as {
      webhook: { id: string }
      secret: string
    }
    expect(secret).toMatch(/^whsec_/)

    const list = (await (await app.request(`/api/v1/forms/${formId}/webhooks`)).json()) as {
      webhooks: { id: string; deliveries: unknown[] }[]
    }
    expect(list.webhooks).toHaveLength(1)
    expect(JSON.stringify(list)).not.toContain(secret) // never re-revealed

    currentUser = 'mallory'
    expect((await app.request(`/api/v1/forms/${formId}/webhooks`)).status).toBe(404)
    expect(
      (
        await app.request(
          `/api/v1/forms/${formId}/webhooks`,
          json({ url: 'https://evil.test/hook' }),
        )
      ).status,
    ).toBe(404)
    currentUser = 'alice'
    expect(
      (await app.request(`/api/v1/forms/${formId}/webhooks/${webhook.id}`, { method: 'DELETE' }))
        .status,
    ).toBe(200)
  })

  it('rejects non-https URLs (localhost excepted)', async () => {
    const formId = await createForm()
    const bad = await app.request(
      `/api/v1/forms/${formId}/webhooks`,
      json({ url: 'http://internal.corp/hook' }),
    )
    expect(bad.status).toBe(400)
    const local = await app.request(
      `/api/v1/forms/${formId}/webhooks`,
      json({ url: 'http://localhost:9999/hook' }),
    )
    expect(local.status).toBe(201)
  })

  it('accepted submissions enqueue one delivery per active webhook (+ notify when toggled)', async () => {
    const formId = await createForm()
    await app.request(`/api/v1/forms/${formId}/webhooks`, json({ url: 'https://a.test/1' }))
    await app.request(`/api/v1/forms/${formId}/webhooks`, json({ url: 'https://b.test/2' }))
    await app.request(`/api/v1/forms/${formId}/publish`, { method: 'POST' })

    currentUser = null
    await app.request(`/api/v1/f/${formId}/responses`, json({ answers: { plan: 'pro' } }))
    const deliveries = queue.sent.filter((job) => job.name === 'webhook.deliver')
    expect(deliveries).toHaveLength(2)
    expect(queue.sent.filter((job) => job.name === 'email.notify')).toHaveLength(0) // not toggled

    // rejected submissions enqueue NOTHING
    await app.request(`/api/v1/f/${formId}/responses`, json({ answers: {} }))
    expect(queue.sent.filter((job) => job.name === 'webhook.deliver')).toHaveLength(2)

    // toggle notifications on (settings live on the draft doc)
    currentUser = 'alice'
    const { form } = (await (await app.request(`/api/v1/forms/${formId}`)).json()) as {
      form: FormDefinition
    }
    await app.request(`/api/v1/forms/${formId}`, {
      ...json({ doc: { ...form, settings: { ...form.settings, notifyOnSubmit: true } } }),
      method: 'PUT',
    })
    currentUser = null
    await app.request(`/api/v1/f/${formId}/responses`, json({ answers: { plan: 'starter' } }))
    expect(queue.sent.filter((job) => job.name === 'email.notify')).toHaveLength(1)
  })
})

describe('S3: meta + openapi', () => {
  it('meta reports mail capability; openapi.json is public and lists the routes', async () => {
    const meta = (await (await app.request('/api/v1/meta')).json()) as {
      mailConfigured: boolean
    }
    expect(meta.mailConfigured).toBe(false) // no mail adapter injected

    currentUser = null
    const spec = await app.request('/api/v1/openapi.json')
    expect(spec.status).toBe(200)
    const body = (await spec.json()) as { openapi: string; paths: Record<string, unknown> }
    expect(body.openapi).toBe('3.1.0')
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/api/v1/f/{id}',
        '/api/v1/forms',
        '/api/v1/api-keys',
        '/api/v1/forms/{id}/responses/summary',
      ]),
    )
    // the paginated list documents its query params from the Zod schema
    const listGet = (
      body.paths['/api/v1/forms/{id}/responses'] as {
        get: { parameters: { name: string }[] }
      }
    ).get
    expect(listGet.parameters.map((p) => p.name)).toEqual(
      expect.arrayContaining(['limit', 'cursor']),
    )
  })
})

describe('S4: the AI exchange', () => {
  async function publishedAiForm(): Promise<string> {
    const doc: FormDefinition = {
      id: 'seed',
      title: 'Interview',
      blocks: [
        { id: 'b_w', ref: 'welcome', type: 'welcome', title: 'Hi', required: false },
        {
          id: 'b_ai',
          ref: 'experience',
          type: 'ai_followup',
          title: 'Tell me about your setup experience.',
          required: true,
          properties: {
            goal: 'find friction points',
            maxFollowups: 2,
            fallbackQuestion: 'What was the hardest part of setup?',
          },
        },
        { id: 'b_end', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
      ],
      logic: [],
      variables: [],
      settings: {},
    }
    const res = await app.request('/api/v1/forms', json({ doc }))
    const { form } = (await res.json()) as { form: FormDefinition }
    await app.request(`/api/v1/forms/${form.id}/publish`, { method: 'POST' })
    currentUser = null // respondent
    return form.id
  }

  it('issues signed questions, honors the cap, and the exchanges submit verifiably', async () => {
    const id = await publishedAiForm()
    const engaged = 'I struggled because the SMTP settings failed on my server every time'

    const step1 = (await (
      await app.request(
        `/api/v1/f/${id}/ai`,
        json({ ref: 'experience', index: 1, baseAnswer: engaged, exchanges: [] }),
      )
    ).json()) as { done: boolean; question: string; meta: Record<string, unknown>; sig: string }
    expect(step1.done).toBe(false)
    expect(step1.question).toContain('?')
    expect(step1.meta.fallback).toBe(false)
    expect(step1.sig).toMatch(/^[0-9a-f]{64}$/)

    // over the cap → done
    const capped = (await (
      await app.request(
        `/api/v1/f/${id}/ai`,
        json({ ref: 'experience', index: 3, baseAnswer: engaged, exchanges: [] }),
      )
    ).json()) as { done: boolean; reason: string }
    expect(capped).toMatchObject({ done: true, reason: 'cap' })

    // submit with the verified exchange → trace persisted
    const submit = await app.request(
      `/api/v1/f/${id}/responses`,
      json({
        answers: { experience: engaged },
        aiExchanges: [
          {
            ref: 'experience',
            index: 1,
            question: step1.question,
            meta: step1.meta,
            sig: step1.sig,
            answer: 'It was the TLS port mismatch mainly',
          },
        ],
      }),
    )
    expect(submit.status).toBe(201)
    const stored = (await submit.json()) as { aiTrace: { question: string; verified: boolean }[] }
    expect(stored.aiTrace).toHaveLength(1)
    expect(stored.aiTrace[0]).toMatchObject({ question: step1.question, verified: true })

    // tampered exchange → rejected wholesale
    const tampered = await app.request(
      `/api/v1/f/${id}/responses`,
      json({
        answers: { experience: engaged },
        aiExchanges: [
          {
            ref: 'experience',
            index: 1,
            question: 'The AI never asked this?',
            meta: step1.meta,
            sig: step1.sig,
            answer: 'forged',
          },
        ],
      }),
    )
    expect(tampered.status).toBe(422)
    expect(((await tampered.json()) as { error: string }).error).toBe('ai_trace_invalid')
  })

  it('provider death at follow-up #1 → the SIGNED static fallback (§12 #2)', async () => {
    const id = await publishedAiForm()
    const step = (await (
      await app.request(
        `/api/v1/f/${id}/ai`,
        json({
          ref: 'experience',
          index: 1,
          baseAnswer: 'I loved it because FAIL_AI it saved me hours of work',
          exchanges: [],
        }),
      )
    ).json()) as { done: boolean; question: string; meta: Record<string, unknown>; sig: string }
    expect(step.done).toBe(false)
    expect(step.question).toBe('What was the hardest part of setup?')
    expect(step.meta.fallback).toBe(true)
    expect(step.sig).toMatch(/^[0-9a-f]{64}$/) // the degradation path is signed too
  })

  it('disengaged answers stop the loop; rate limiting kicks in', async () => {
    const id = await publishedAiForm()
    const stop = (await (
      await app.request(
        `/api/v1/f/${id}/ai`,
        json({ ref: 'experience', index: 1, baseAnswer: 'no', exchanges: [] }),
      )
    ).json()) as { done: boolean; reason: string }
    expect(stop).toMatchObject({ done: true, reason: 'engagement' })

    let limited = 0
    for (let i = 0; i < 35; i++) {
      const res = await app.request(
        `/api/v1/f/${id}/ai`,
        json({ ref: 'experience', index: 1, baseAnswer: 'no', exchanges: [] }),
      )
      if (res.status === 429) limited++
    }
    expect(limited).toBeGreaterThan(0)
  })
})

describe('S4: form generation', () => {
  it('generates a valid draft (session-only, ai-gated)', async () => {
    const res = await app.request('/api/v1/forms/generate', json({ prompt: 'bakery feedback' }))
    expect(res.status).toBe(201)
    const { form } = (await res.json()) as { form: FormDefinition }
    expect(form.blocks[0]?.type).toBe('welcome')
    expect(form.blocks.length).toBeGreaterThanOrEqual(3)
    // it publishes clean — the generated draft passes the same gate
    const publish = await app.request(`/api/v1/forms/${form.id}/publish`, { method: 'POST' })
    expect(publish.status).toBe(200)
  })

  it('meta reports aiConfigured', async () => {
    const meta = (await (await app.request('/api/v1/meta')).json()) as {
      aiConfigured: boolean
    }
    expect(meta.aiConfigured).toBe(true)
  })
})

describe('S5: hardening', () => {
  it('honeypot submissions get a success-shaped 201 but store NOTHING', async () => {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    currentUser = null // a bot filled the hidden field
    const res = await app.request(
      `/api/v1/f/${id}/responses`,
      json({ answers: { plan: 'pro' }, _hp: 'https://spam.example' }),
    )
    expect(res.status).toBe(201) // indistinguishable from success
    const body = (await res.json()) as { id: string; formVersion: number }
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(body.formVersion).toBe(1)

    currentUser = 'alice'
    const list = (await (await app.request(`/api/v1/forms/${id}/responses`)).json()) as {
      responses: unknown[]
    }
    expect(list.responses).toEqual([]) // discarded

    // even INVALID answers get the same 201 — no validation oracle for bots
    currentUser = null
    const invalid = await app.request(`/api/v1/f/${id}/responses`, json({ answers: {}, _hp: 'x' }))
    expect(invalid.status).toBe(201)
  })

  it('the submit endpoint rate-limits per ip+form (FORMSMITH_SUBMIT_RATE)', async () => {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    const limited = createApi({
      db,
      getSession: async () => null,
      submitRatePerMinute: 2,
    })
    const submit = () =>
      limited.request(`/api/v1/f/${id}/responses`, json({ answers: { plan: 'pro' } }))
    expect((await submit()).status).toBe(201)
    expect((await submit()).status).toBe(201)
    expect((await submit()).status).toBe(429)
  })

  it('oversize public bodies die at the door (413), not in JSON.parse', async () => {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    currentUser = null
    const res = await app.request(`/api/v1/f/${id}/responses`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: `{"answers":{"plan":"${'x'.repeat(1_100_000)}"}}`,
    })
    expect(res.status).toBe(413)
  })
})

describe('S5b: the cache layer', () => {
  it('publish busts the latest-snapshot cache — v2 serves IMMEDIATELY', async () => {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    // warm the latest-pointer cache as a respondent
    currentUser = null
    const v1 = (await (await app.request(`/api/v1/f/${id}`)).json()) as {
      form: { version: number }
    }
    expect(v1.form.version).toBe(1)

    // owner edits + republishes
    currentUser = 'alice'
    await app.request(`/api/v1/forms/${id}`, {
      ...json({ doc: { ...quizDoc(), id, title: 'Edited for v2' } }),
      method: 'PUT',
    })
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    // no 60s staleness on this instance: the bust makes v2 immediate
    currentUser = null
    const v2 = (await (await app.request(`/api/v1/f/${id}`)).json()) as {
      form: { version: number; title: string }
    }
    expect(v2.form.version).toBe(2)
    expect(v2.form.title).toBe('Edited for v2')
  })

  it('a BROKEN cache never fails a request (fail-open proven end to end)', async () => {
    const poisoned = {
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
    const brokenApp = createApi({
      db,
      getSession: async () =>
        currentUser === null ? null : { userId: currentUser, emailVerified: currentVerified },
      cache: poisoned,
    })

    const create = await brokenApp.request('/api/v1/forms', json({ doc: quizDoc() }))
    expect(create.status).toBe(201)
    const { form } = (await create.json()) as { form: FormDefinition }
    await brokenApp.request(`/api/v1/forms/${form.id}/publish`, { method: 'POST' })

    currentUser = null
    expect((await brokenApp.request(`/api/v1/f/${form.id}`)).status).toBe(200)
    const submit = await brokenApp.request(
      `/api/v1/f/${form.id}/responses`,
      json({ answers: { plan: 'pro' } }),
    )
    expect(submit.status).toBe(201) // limiter degraded OPEN, snapshot read fell through
    currentUser = 'alice'
  })

  it('the compiled-evaluator memo keeps the trust boundary intact across reuse', async () => {
    const id = await createForm()
    await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })

    currentUser = null
    // same (form, version) evaluated repeatedly — the SECOND run uses the memo
    const ok1 = await app.request(`/api/v1/f/${id}/responses`, json({ answers: { plan: 'pro' } }))
    expect(ok1.status).toBe(201)
    const tampered = await app.request(
      `/api/v1/f/${id}/responses`,
      json({ answers: { plan: 'starter' }, variables: { score: 999 } }),
    )
    expect(tampered.status).toBe(422) // memoized evaluator still rejects tampering
    const ok2 = await app.request(`/api/v1/f/${id}/responses`, json({ answers: { plan: 'pro' } }))
    expect(ok2.status).toBe(201)
    const body = (await ok2.json()) as { variables: Record<string, unknown> }
    expect(body.variables).toEqual({ score: 10 }) // recomputed, not cached
  })
})

describe('quotas + AI credits (v0.1.5)', () => {
  // a second app over the SAME db/session, but with strict quota values (hosted
  // is just this with real numbers). The default `app` has none = unlimited.
  const apiWith = (quotas: ApiDeps['quotas']) =>
    createApi({
      db,
      getSession: async () =>
        currentUser === null ? null : { userId: currentUser, emailVerified: currentVerified },
      queue,
      ai: { provider: createMockProvider() },
      signingSecret: 'test-signing-secret',
      quotas,
    })

  const aiForm = (): FormDefinition => ({
    id: 'seed',
    title: 'Interview',
    blocks: [
      { id: 'b_w', ref: 'welcome', type: 'welcome', title: 'Hi', required: false },
      {
        id: 'b_ai',
        ref: 'experience',
        type: 'ai_followup',
        title: 'Tell me about your setup.',
        required: true,
        properties: { goal: 'friction', maxFollowups: 2, fallbackQuestion: 'Hardest part?' },
      },
      { id: 'b_end', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
    ],
    logic: [],
    variables: [],
    settings: {},
  })

  it('forms quota: create up to the limit, then 403', async () => {
    const q = apiWith({ forms: 1 })
    expect((await q.request('/api/v1/forms', json({ doc: quizDoc() }))).status).toBe(201)
    const over = await q.request('/api/v1/forms', json({ doc: quizDoc() }))
    expect(over.status).toBe(403)
    expect(await over.json()).toEqual({ error: 'quota_exceeded', resource: 'forms' })
  })

  it('API-key quota: create up to the limit, then 403', async () => {
    const q = apiWith({ apiKeysPerWorkspace: 1 })
    expect((await q.request('/api/v1/api-keys', json({ name: 'a' }))).status).toBe(201)
    expect((await q.request('/api/v1/api-keys', json({ name: 'b' }))).status).toBe(403)
  })

  it('webhook quota is per form: create up to the limit, then 403', async () => {
    const q = apiWith({ webhooksPerForm: 1 })
    const { form } = (await (
      await q.request('/api/v1/forms', json({ doc: quizDoc() }))
    ).json()) as {
      form: FormDefinition
    }
    const first = await q.request(
      `/api/v1/forms/${form.id}/webhooks`,
      json({ url: 'https://a.test/1' }),
    )
    expect(first.status).toBe(201)
    const over = await q.request(
      `/api/v1/forms/${form.id}/webhooks`,
      json({ url: 'https://a.test/2' }),
    )
    expect(over.status).toBe(403)
    expect(await over.json()).toEqual({ error: 'quota_exceeded', resource: 'webhooks' })
  })

  it('monthly response cap: at the cap the form closes, nothing is stored', async () => {
    const q = apiWith({ responsesPerMonth: 1 })
    const { form } = (await (
      await q.request('/api/v1/forms', json({ doc: quizDoc() }))
    ).json()) as {
      form: FormDefinition
    }
    await q.request(`/api/v1/forms/${form.id}/publish`, { method: 'POST' })

    currentUser = null // respondent
    expect(
      (await q.request(`/api/v1/f/${form.id}/responses`, json({ answers: { plan: 'pro' } })))
        .status,
    ).toBe(201)
    const closed = await q.request(
      `/api/v1/f/${form.id}/responses`,
      json({ answers: { plan: 'pro' } }),
    )
    expect(closed.status).toBe(403)
    expect(await closed.json()).toEqual({ error: 'form_over_capacity' })

    currentUser = 'alice'
    const list = (await (await q.request(`/api/v1/forms/${form.id}/responses`)).json()) as {
      responses: unknown[]
    }
    expect(list.responses).toHaveLength(1) // the rejected one never landed
  })

  it('AI generation: exhausted credits return a friendly 403 (no provider call)', async () => {
    const q = apiWith({ aiCreditsDefault: 0 }) // zero balance from the start
    const res = await q.request('/api/v1/forms/generate', json({ prompt: 'a signup form' }))
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'ai_credits_exhausted' })
  })

  it('AI exchange: a live credit is spent; exhaustion degrades to the fallback', async () => {
    const workspaceId = (await workspaceForUser(db, 'alice'))?.id ?? ''
    const credits = creditsRepository(db)

    // one credit available: the first exchange spends it and asks a real question
    const q = apiWith({ aiCreditsDefault: 1 })
    const { form } = (await (await q.request('/api/v1/forms', json({ doc: aiForm() }))).json()) as {
      form: FormDefinition
    }
    await q.request(`/api/v1/forms/${form.id}/publish`, { method: 'POST' })
    currentUser = null

    const live = (await (
      await q.request(
        `/api/v1/f/${form.id}/ai`,
        json({
          ref: 'experience',
          index: 1,
          baseAnswer: 'SMTP kept failing on my box',
          exchanges: [],
        }),
      )
    ).json()) as { done: boolean; meta: Record<string, unknown> }
    expect(live.done).toBe(false)
    expect(live.meta.fallback).toBe(false) // a real model question
    expect(await credits.get(workspaceId)).toEqual({ remaining: 0, granted: 1 }) // spent

    // now exhausted: the next exchange degrades to the static fallback, audited
    const degraded = (await (
      await q.request(
        `/api/v1/f/${form.id}/ai`,
        json({ ref: 'experience', index: 1, baseAnswer: 'more detail', exchanges: [] }),
      )
    ).json()) as { done: boolean; question?: string; meta?: Record<string, unknown> }
    expect(degraded.question).toBe('Hardest part?')
    expect(degraded.meta?.fallback).toBe(true)
    expect(degraded.meta?.reason).toBe('credits_exhausted')
  })

  it('generous limits are never hit (unset stays unlimited)', async () => {
    const q = apiWith({ forms: 100, apiKeysPerWorkspace: 100 })
    for (let i = 0; i < 3; i += 1) {
      expect((await q.request('/api/v1/forms', json({ doc: quizDoc() }))).status).toBe(201)
    }
  })
})

describe('email verification gate (v0.1.5 B)', () => {
  const verifyingApi = () =>
    createApi({
      db,
      getSession: async () =>
        currentUser === null ? null : { userId: currentUser, emailVerified: currentVerified },
      queue,
      ai: { provider: createMockProvider() },
      signingSecret: 'test-signing-secret',
      requireVerifiedEmail: true,
    })

  async function draftOn(q: ReturnType<typeof createApi>): Promise<string> {
    const { form } = (await (
      await q.request('/api/v1/forms', json({ doc: quizDoc() }))
    ).json()) as {
      form: FormDefinition
    }
    return form.id
  }

  it('unverified session can build but cannot publish, generate, or mint a key', async () => {
    const q = verifyingApi()
    currentVerified = false
    const id = await draftOn(q) // building is open to unverified accounts

    const pub = await q.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })
    expect(pub.status).toBe(403)
    expect(await pub.json()).toEqual({ error: 'email_not_verified' })
    expect((await q.request('/api/v1/forms/generate', json({ prompt: 'a form' }))).status).toBe(403)
    expect((await q.request('/api/v1/api-keys', json({ name: 'k' }))).status).toBe(403)
  })

  it('verified session sails through publish + key mint', async () => {
    const q = verifyingApi()
    currentVerified = true
    const id = await draftOn(q)
    expect((await q.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })).status).toBe(200)
    expect((await q.request('/api/v1/api-keys', json({ name: 'k' }))).status).toBe(201)
  })

  it('with verification OFF (the default), an unverified account can publish', async () => {
    currentVerified = false // the default `app` has requireVerifiedEmail unset
    const id = await createForm()
    expect((await app.request(`/api/v1/forms/${id}/publish`, { method: 'POST' })).status).toBe(200)
  })

  it('an API key bypasses the gate (deliberate credential, verified at mint time)', async () => {
    const q = verifyingApi()
    currentVerified = true
    const secret = (
      (await (await q.request('/api/v1/api-keys', json({ name: 'ci' }))).json()) as {
        secret: string
      }
    ).secret
    const id = await draftOn(q)

    currentVerified = false
    currentUser = null // force the bearer path
    const pub = await q.request(`/api/v1/forms/${id}/publish`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    })
    expect(pub.status).toBe(200)
  })

  it('/meta reports whether verification is required', async () => {
    expect(
      (
        (await (await verifyingApi().request('/api/v1/meta')).json()) as {
          verificationRequired: boolean
        }
      ).verificationRequired,
    ).toBe(true)
    expect(
      ((await (await app.request('/api/v1/meta')).json()) as { verificationRequired: boolean })
        .verificationRequired,
    ).toBe(false)
  })
})
