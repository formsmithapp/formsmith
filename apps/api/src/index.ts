// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from '@formsmithapp/db'
import { formsRepository, responsesRepository, schema, workspaceForUser } from '@formsmithapp/db'
import type { FormDefinition } from '@formsmithapp/engine'
import {
  createFormInput,
  importInput,
  submissionInput,
  updateFormInput,
} from '@formsmithapp/schemas'
import { zValidator } from '@hono/zod-validator'
import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { evaluate, isUuid, validateFormDocument } from './service'

/**
 * The Formsmith data plane — a MOUNTABLE Hono app. The v1 unified build
 * mounts it inside Next at `/api/v1`; the same app deploys standalone
 * (Node today via src/server.ts, Workers in the hosted phase) with zero
 * rewrite. Auth stays with the host: the app receives `getSession`.
 */

export interface ApiDeps {
  db: Database
  /** Resolves the signed-in user from request headers (Better Auth in v1). */
  getSession: (headers: Headers) => Promise<{ userId: string } | null>
}

interface Env {
  Variables: { workspaceId: string }
}

export function createApi(deps: ApiDeps, basePath = '/api/v1') {
  const forms = formsRepository(deps.db)
  const responses = responsesRepository(deps.db)

  /** Session + workspace gate for the dashboard surface. */
  const requireWorkspace = createMiddleware<Env>(async (c, next) => {
    const session = await deps.getSession(c.req.raw.headers)
    if (session === null) return c.json({ error: 'unauthorized' }, 401)
    const workspace = await workspaceForUser(deps.db, session.userId)
    if (workspace === null) return c.json({ error: 'no workspace' }, 403)
    c.set('workspaceId', workspace.id)
    await next()
  })

  /** Latest published snapshot, or a pinned version — public submit path. */
  async function snapshotForSubmit(
    formId: string,
    version: number | undefined,
  ): Promise<{ doc: FormDefinition; version: number } | null> {
    if (version !== undefined) {
      const rows = await deps.db
        .select({ doc: schema.formVersions.doc })
        .from(schema.formVersions)
        .where(
          and(eq(schema.formVersions.formId, formId), eq(schema.formVersions.version, version)),
        )
        .limit(1)
      const doc = rows[0]?.doc
      return doc === undefined ? null : { doc, version }
    }
    const doc = await forms.getPublicSnapshot(formId)
    return doc === null || doc.version === undefined ? null : { doc, version: doc.version }
  }

  const summarize = (row: {
    id: string
    title: string
    status: string
    publishedVersion: number | null
    doc: FormDefinition
    updatedAt: Date
  }) => ({
    id: row.id,
    title: row.title,
    status: row.status as 'draft' | 'published',
    publishedVersion: row.publishedVersion ?? undefined,
    blockCount: row.doc.blocks.length,
    updatedAt: row.updatedAt.toISOString(),
  })

  const stored = (row: {
    doc: FormDefinition
    status: string
    publishedVersion: number | null
    createdAt: Date
    updatedAt: Date
  }) => ({
    form: row.doc,
    status: row.status as 'draft' | 'published',
    publishedVersion: row.publishedVersion ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

  const app = new Hono<Env>()
    .basePath(basePath)

    /* ---------- public: serve & submit ---------- */

    .get('/f/:id', async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const doc = await forms.getPublicSnapshot(id)
      if (doc === null) return c.json({ error: 'not found' }, 404)
      // immutable per version — safe to get more aggressive at the edge later
      c.header('Cache-Control', 'public, max-age=60')
      return c.json({ form: doc })
    })

    .post('/f/:id/responses', zValidator('json', submissionInput), async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const payload = c.req.valid('json')
      const snapshot = await snapshotForSubmit(id, payload.formVersion)
      if (snapshot === null) return c.json({ error: 'not found' }, 404)

      const outcome = evaluate(snapshot.doc, payload)
      if (!outcome.ok) return c.json({ error: 'rejected', issues: outcome.issues }, 422)

      const row = await responses.insert({
        formId: id,
        formVersion: snapshot.version,
        answers: outcome.answers,
        variables: outcome.variables,
        hidden: payload.hiddenFields ?? {},
        ending: outcome.ending,
      })
      return c.json({ ...row, submittedAt: row.submittedAt.toISOString() }, 201)
    })

    /* ---------- dashboard: session + workspace scoped ---------- */

    .use('/forms/*', requireWorkspace)
    .use('/forms', requireWorkspace)
    .use('/import', requireWorkspace)

    .get('/forms', async (c) => {
      const rows = await forms.list(c.get('workspaceId'))
      return c.json({ forms: rows.map(summarize) })
    })

    .post('/forms', zValidator('json', createFormInput), async (c) => {
      const body = c.req.valid('json')
      if (body.doc === undefined) return c.json({ error: 'doc is required' }, 400)
      const row = await forms.create(
        c.get('workspaceId'),
        body.doc as unknown as FormDefinition,
        body.title,
      )
      return c.json(stored(row), 201)
    })

    .get('/forms/:id', async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const row = await forms.get(c.get('workspaceId'), id)
      return row === null ? c.json({ error: 'not found' }, 404) : c.json(stored(row))
    })

    .put('/forms/:id', zValidator('json', updateFormInput), async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const body = c.req.valid('json')
      const saved = await forms.save(
        c.get('workspaceId'),
        id,
        body.doc as unknown as FormDefinition,
      )
      return saved ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
    })

    .delete('/forms/:id', async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const removed = await forms.remove(c.get('workspaceId'), id)
      return removed ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
    })

    .post('/forms/:id/publish', async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const row = await forms.get(c.get('workspaceId'), id)
      if (row === null) return c.json({ error: 'not found' }, 404)
      const issues = validateFormDocument(row.doc)
      if (issues.length > 0) return c.json({ error: 'invalid', issues }, 422)
      const result = await forms.publish(c.get('workspaceId'), id)
      if (result === null) return c.json({ error: 'not found' }, 404)
      return c.json(result)
    })

    .post('/forms/:id/duplicate', async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const row = await forms.duplicate(c.get('workspaceId'), id)
      return row === null ? c.json({ error: 'not found' }, 404) : c.json(stored(row), 201)
    })

    .get('/forms/:id/versions/:version', async (c) => {
      const id = c.req.param('id')
      const version = Number(c.req.param('version'))
      if (!isUuid(id) || !Number.isInteger(version) || version < 1) {
        return c.json({ error: 'not found' }, 404)
      }
      const doc = await forms.getSnapshot(c.get('workspaceId'), id, version)
      return doc === null ? c.json({ error: 'not found' }, 404) : c.json({ form: doc })
    })

    .get('/forms/:id/responses', async (c) => {
      const id = c.req.param('id')
      if (!isUuid(id)) return c.json({ error: 'not found' }, 404)
      const rows = await responses.list(c.get('workspaceId'), id)
      return c.json({
        responses: rows.map((row) => ({ ...row, submittedAt: row.submittedAt.toISOString() })),
      })
    })

    .get('/forms/:id/responses/:responseId', async (c) => {
      const id = c.req.param('id')
      const responseId = c.req.param('responseId')
      if (!isUuid(id) || !isUuid(responseId)) return c.json({ error: 'not found' }, 404)
      const row = await responses.get(c.get('workspaceId'), id, responseId)
      return row === null
        ? c.json({ error: 'not found' }, 404)
        : c.json({ ...row, submittedAt: row.submittedAt.toISOString() })
    })

    .delete('/forms/:id/responses/:responseId', async (c) => {
      const id = c.req.param('id')
      const responseId = c.req.param('responseId')
      if (!isUuid(id) || !isUuid(responseId)) return c.json({ error: 'not found' }, 404)
      const removed = await responses.remove(c.get('workspaceId'), id, responseId)
      return removed ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
    })

    /* ---------- local-first migration ---------- */

    .post('/import', zValidator('json', importInput), async (c) => {
      const body = c.req.valid('json')
      const imported: { sourceId: string; id: string }[] = []
      for (const entry of body.forms) {
        const row = await forms.importForm(c.get('workspaceId'), {
          doc: entry.doc as unknown as FormDefinition,
          status: entry.status,
          publishedVersion: entry.publishedVersion,
          versions: entry.versions.map((v) => ({
            version: v.version,
            doc: v.doc as unknown as FormDefinition,
          })),
        })
        imported.push({ sourceId: entry.sourceId, id: row.id })
      }
      return c.json({ imported }, 201)
    })

  return app
}

export type AppType = ReturnType<typeof createApi>
