// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { MailAdapter, QueueAdapter } from '@formsmithapp/adapters'
import { generateFollowup, generateFormDocument, type ModelProvider } from '@formsmithapp/ai'
import type { Database } from '@formsmithapp/db'
import {
  apiKeysRepository,
  formsRepository,
  responsesRepository,
  schema,
  webhooksRepository,
  workspaceForUser,
} from '@formsmithapp/db'
import type { FormDefinition } from '@formsmithapp/engine'
import {
  aiFollowupInput,
  createApiKeyInput,
  createFormInput,
  createWebhookInput,
  generateFormInput,
  importInput,
  submissionInput,
  updateFormInput,
} from '@formsmithapp/schemas'
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { type ExchangeTuple, signExchange, verifyExchange } from './ai-sign'
import { generateApiKey, generateWebhookSecret, hashApiKey } from './keys'
import { createRateLimiter } from './rate-limit'
import { evaluate, isUuid, validateFormDocument } from './service'
import { WEBHOOK_RETRY } from './workers'

/**
 * The Formsmith data plane — a MOUNTABLE OpenAPIHono app: the v1 unified
 * build mounts it inside Next at `/api/v1`; the same app deploys standalone.
 * Since S3 the SAME routes are the public REST API (bearer API keys) and the
 * same Zod that validates them emits /api/v1/openapi.json.
 */

export interface ApiDeps {
  db: Database
  /** Resolves the signed-in user from request headers (Better Auth in v1). */
  getSession: (headers: Headers) => Promise<{ userId: string } | null>
  /** Background jobs (webhooks, notifications). Absent → integrations 503. */
  queue?: QueueAdapter
  mail?: MailAdapter
  /** The AI provider chain. Absent → ai_followup blocks run fallback-only. */
  ai?: { provider: ModelProvider }
  /** Signs AI exchanges (incl. the fallback path, which works with AI off).
   * Absent → no exchange loop at all (base questions only). */
  signingSecret?: string
}

interface Env {
  Variables: { workspaceId: string; authVia: 'session' | 'key' }
}

/* ---------- response DTOs (they also document the spec) ---------- */

const errorDto = z.object({ error: z.string(), issues: z.array(z.unknown()).optional() })
const formDoc = z.record(z.string(), z.unknown()).openapi({ description: 'Form document' })
const formSummaryDto = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'published']),
  publishedVersion: z.number().optional(),
  blockCount: z.number(),
  updatedAt: z.string(),
})
const storedFormDto = z.object({
  form: formDoc,
  status: z.enum(['draft', 'published']),
  publishedVersion: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const responseRowDto = z.object({
  id: z.string(),
  formId: z.string(),
  formVersion: z.number(),
  submittedAt: z.string(),
  answers: z.record(z.string(), z.unknown()),
  variables: z.record(z.string(), z.unknown()),
  hidden: z.record(z.string(), z.string()),
  ending: z.string().nullable(),
  aiTrace: z.array(z.unknown()).nullable(),
})
const aiStepDto = z.object({
  done: z.boolean(),
  reason: z.string().optional(),
  question: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
  sig: z.string().optional(),
})
const usageBucketDto = z.object({ day: z.string(), requests: z.number() })
const apiKeyDto = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
  usage: z.array(usageBucketDto),
  total: z.number(),
})
const deliveryDto = z.object({
  id: z.string(),
  event: z.string(),
  attempt: z.number(),
  status: z.number().nullable(),
  error: z.string().nullable(),
  durationMs: z.number(),
  createdAt: z.string(),
})
const webhookDto = z.object({
  id: z.string(),
  url: z.string(),
  active: z.boolean(),
  lastStatus: z.number().nullable(),
  lastError: z.string().nullable(),
  lastAttemptAt: z.string().nullable(),
  createdAt: z.string(),
  deliveries: z.array(deliveryDto),
})

const jsonBody = <T extends z.ZodType>(schema: T) => ({
  content: { 'application/json': { schema } },
})
const jsonResponse = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { 'application/json': { schema } },
  description,
})
const idParam = z.object({ id: z.string().openapi({ format: 'uuid' }) })

const NOT_FOUND = { error: 'not found' }

export function createApi(deps: ApiDeps, basePath = '/api/v1') {
  const forms = formsRepository(deps.db)
  const responses = responsesRepository(deps.db)
  const apiKeys = apiKeysRepository(deps.db)
  const webhooks = webhooksRepository(deps.db)

  const todayUtc = () => new Date().toISOString().slice(0, 10)

  /** Session first, then `Authorization: Bearer fsk_…` — the public REST API. */
  const requireWorkspace = createMiddleware<Env>(async (c, next) => {
    const session = await deps.getSession(c.req.raw.headers)
    if (session !== null) {
      const workspace = await workspaceForUser(deps.db, session.userId)
      if (workspace === null) return c.json({ error: 'no workspace' }, 403)
      c.set('workspaceId', workspace.id)
      c.set('authVia', 'session')
      return next()
    }
    const header = c.req.header('authorization')
    if (header?.startsWith('Bearer fsk_') === true) {
      const key = await apiKeys.findByHash(hashApiKey(header.slice('Bearer '.length)))
      if (key !== null) {
        c.set('workspaceId', key.workspaceId)
        c.set('authVia', 'key')
        // metrics/telemetry must never fail a request
        void apiKeys.touchLastUsed(key.id).catch(() => {})
        void apiKeys.recordUsage(key.id, todayUtc()).catch(() => {})
        return next()
      }
    }
    return c.json({ error: 'unauthorized' }, 401)
  })

  /** Keys must not mint keys: the key-management surface is session-only. */
  const requireSession = createMiddleware<Env>(async (c, next) => {
    const session = await deps.getSession(c.req.raw.headers)
    if (session === null) return c.json({ error: 'unauthorized' }, 401)
    const workspace = await workspaceForUser(deps.db, session.userId)
    if (workspace === null) return c.json({ error: 'no workspace' }, 403)
    c.set('workspaceId', workspace.id)
    c.set('authVia', 'session')
    await next()
  })

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
    status: 'draft' | 'published'
    publishedVersion: number | null
    doc: FormDefinition
    updatedAt: Date
  }) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    publishedVersion: row.publishedVersion ?? undefined,
    blockCount: row.doc.blocks.length,
    updatedAt: row.updatedAt.toISOString(),
  })

  const stored = (row: {
    doc: FormDefinition
    status: 'draft' | 'published'
    publishedVersion: number | null
    createdAt: Date
    updatedAt: Date
  }) => ({
    form: row.doc as unknown as Record<string, unknown>,
    status: row.status,
    publishedVersion: row.publishedVersion ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  })

  const responseJson = (row: {
    id: string
    formId: string
    formVersion: number
    submittedAt: Date
    answers: Record<string, unknown>
    variables: Record<string, unknown>
    hidden: Record<string, string>
    ending: string | null
    aiTrace: unknown[] | null
  }) => ({ ...row, submittedAt: row.submittedAt.toISOString() })

  const app = new OpenAPIHono<Env>().basePath(basePath)

  // NOTE: in Hono, `/x/*` also matches `/x` — register each surface ONCE,
  // or the middleware (and usage recording) runs twice per request.
  app.use('/forms/*', requireWorkspace)
  app.use('/import', requireWorkspace)
  app.use('/meta', requireWorkspace)
  app.use('/api-keys/*', requireSession)

  /* ---------- public: serve & submit ---------- */

  app.openapi(
    createRoute({
      method: 'get',
      path: '/f/{id}',
      tags: ['public'],
      summary: 'Serve the latest published form snapshot',
      request: { params: idParam },
      responses: {
        200: jsonResponse(z.object({ form: formDoc }), 'The published form document'),
        404: jsonResponse(errorDto, 'Unknown or unpublished form'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const doc = await forms.getPublicSnapshot(id)
      if (doc === null) return c.json(NOT_FOUND, 404)
      c.header('Cache-Control', 'public, max-age=60') // immutable per version
      return c.json({ form: doc as unknown as Record<string, unknown> }, 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/f/{id}/responses',
      tags: ['public'],
      summary: 'Submit a response (re-evaluated server-side)',
      request: { params: idParam, body: jsonBody(submissionInput) },
      responses: {
        201: jsonResponse(responseRowDto, 'The stored response (variables recomputed)'),
        404: jsonResponse(errorDto, 'Unknown or unpublished form'),
        422: jsonResponse(errorDto, 'Rejected by server-side re-evaluation'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const payload = c.req.valid('json')
      const snapshot = await snapshotForSubmit(id, payload.formVersion)
      if (snapshot === null) return c.json(NOT_FOUND, 404)

      const outcome = evaluate(snapshot.doc, payload)
      if (!outcome.ok) return c.json({ error: 'rejected', issues: outcome.issues }, 422)

      // AI exchanges: every server-issued question carries a signature — an
      // unverifiable exchange means a forged transcript. Reject, don't strip.
      let aiTrace: unknown[] | null = null
      if (payload.aiExchanges !== undefined && payload.aiExchanges.length > 0) {
        const secret = deps.signingSecret
        if (secret === undefined) {
          return c.json({ error: 'ai_trace_invalid', issues: [] }, 422)
        }
        for (const exchange of payload.aiExchanges) {
          const tuple: ExchangeTuple = {
            formId: id,
            ref: exchange.ref,
            index: exchange.index,
            question: exchange.question,
            meta: exchange.meta,
          }
          if (!verifyExchange(secret, tuple, exchange.sig)) {
            return c.json({ error: 'ai_trace_invalid', issues: [] }, 422)
          }
        }
        aiTrace = payload.aiExchanges.map((exchange) => ({
          ref: exchange.ref,
          index: exchange.index,
          question: exchange.question,
          answer: exchange.answer,
          ...exchange.meta,
          verified: true,
        }))
      }

      const row = await responses.insert({
        formId: id,
        formVersion: snapshot.version,
        answers: outcome.answers,
        variables: outcome.variables,
        hidden: payload.hiddenFields ?? {},
        ending: outcome.ending,
        aiTrace,
      })

      // integrations are queued post-commit and must never fail the submission
      if (deps.queue !== undefined) {
        try {
          const hooks = await webhooks.listActiveByForm(id)
          for (const hook of hooks) {
            await deps.queue.send(
              'webhook.deliver',
              { webhookId: hook.id, formId: id, responseId: row.id, event: 'response.created' },
              WEBHOOK_RETRY,
            )
          }
          const [formRow] = await deps.db
            .select({ doc: schema.forms.doc })
            .from(schema.forms)
            .where(eq(schema.forms.id, id))
            .limit(1)
          const settings = formRow?.doc.settings as { notifyOnSubmit?: boolean } | undefined
          if (settings?.notifyOnSubmit === true) {
            await deps.queue.send('email.notify', { formId: id, responseId: row.id })
          }
        } catch (error) {
          console.error('[submit] enqueue failed', error)
        }
      }
      return c.json(responseJson(row), 201)
    },
  )

  /* ---------- public: the AI follow-up exchange ---------- */

  // in-slice guard: this endpoint spends the operator's LLM budget
  const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 30 })
  const clientIp = (headers: Headers) =>
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'

  app.openapi(
    createRoute({
      method: 'post',
      path: '/f/{id}/ai',
      tags: ['public'],
      summary: 'Request the next AI follow-up in an exchange (signed)',
      request: { params: idParam, body: jsonBody(aiFollowupInput) },
      responses: {
        200: jsonResponse(aiStepDto, 'A signed question, or done'),
        404: jsonResponse(errorDto, 'Unknown form / not an ai_followup block'),
        422: jsonResponse(errorDto, 'Tampered exchange history'),
        429: jsonResponse(errorDto, 'Rate limited'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      if (!aiLimiter.allow(`${clientIp(c.req.raw.headers)}:${id}`)) {
        return c.json({ error: 'rate limited' }, 429)
      }
      const input = c.req.valid('json')
      const secret = deps.signingSecret
      if (secret === undefined) return c.json({ done: true, reason: 'ai_unconfigured' }, 200)

      const snapshot = await forms.getPublicSnapshot(id)
      const block = snapshot?.blocks.find((b) => b.ref === input.ref && b.type === 'ai_followup')
      if (snapshot === undefined || snapshot === null || block === undefined) {
        return c.json(NOT_FOUND, 404)
      }
      const properties = (block.properties ?? {}) as {
        goal?: string
        maxFollowups?: number
        fallbackQuestion?: string
      }
      const maxFollowups = Math.min(Math.max(properties.maxFollowups ?? 1, 1), 5)
      if (input.index > maxFollowups) return c.json({ done: true, reason: 'cap' }, 200)

      // prior exchanges must be authentic before they enter a prompt
      for (const exchange of input.exchanges) {
        const tuple: ExchangeTuple = {
          formId: id,
          ref: input.ref,
          index: exchange.index,
          question: exchange.question,
          meta: exchange.meta,
        }
        if (!verifyExchange(secret, tuple, exchange.sig)) {
          return c.json({ error: 'ai_trace_invalid' }, 422)
        }
      }

      const issue = (question: string, meta: Record<string, unknown>) => {
        const sig = signExchange(secret, {
          formId: id,
          ref: input.ref,
          index: input.index,
          question,
          meta,
        })
        return c.json({ done: false, question, meta, sig }, 200)
      }
      const fallbackMeta = (reason: string) => ({
        fallback: true,
        reason,
        model: deps.ai?.provider.name ?? null,
      })

      if (deps.ai === undefined) {
        // AI off: the static fallback IS follow-up #1; nothing after it
        if (input.index === 1 && properties.fallbackQuestion !== undefined) {
          return issue(properties.fallbackQuestion, fallbackMeta('ai_off'))
        }
        return c.json({ done: true, reason: 'ai_off' }, 200)
      }

      const started = Date.now()
      const outcome = await generateFollowup(deps.ai.provider, {
        goal: properties.goal ?? block.title,
        formTitle: snapshot.title ?? 'this form',
        baseQuestion: block.title,
        baseAnswer: input.baseAnswer,
        exchanges: input.exchanges.map((e) => ({ question: e.question, answer: e.answer })),
        index: input.index,
        maxFollowups,
      })
      const latencyMs = Date.now() - started

      if (outcome.kind === 'question') {
        return issue(outcome.question, {
          fallback: false,
          type: outcome.type,
          engagement: Number(outcome.engagement.toFixed(3)),
          model: deps.ai.provider.name,
          latencyMs,
        })
      }
      if (
        outcome.kind === 'failed' &&
        input.index === 1 &&
        properties.fallbackQuestion !== undefined
      ) {
        // the degradation path §12 #2: seamless static fallback, audited
        return issue(properties.fallbackQuestion, {
          ...fallbackMeta(`error:${outcome.reason}`),
          latencyMs,
        })
      }
      return c.json({ done: true, reason: outcome.kind === 'stop' ? outcome.reason : 'error' }, 200)
    },
  )

  /* ---------- dashboard + public REST: forms ---------- */

  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms',
      tags: ['forms'],
      summary: 'List forms in the workspace',
      security: [{ bearerAuth: [] }],
      responses: { 200: jsonResponse(z.object({ forms: z.array(formSummaryDto) }), 'Summaries') },
    }),
    async (c) => {
      const rows = await forms.list(c.get('workspaceId'))
      return c.json({ forms: rows.map(summarize) }, 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/forms',
      tags: ['forms'],
      summary: 'Create a form from a document',
      security: [{ bearerAuth: [] }],
      request: { body: jsonBody(createFormInput) },
      responses: {
        201: jsonResponse(storedFormDto, 'The stored form'),
        400: jsonResponse(errorDto, 'Missing document'),
      },
    }),
    async (c) => {
      const body = c.req.valid('json')
      if (body.doc === undefined) return c.json({ error: 'doc is required' }, 400)
      const row = await forms.create(
        c.get('workspaceId'),
        body.doc as unknown as FormDefinition,
        body.title,
      )
      return c.json(stored(row), 201)
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms/{id}',
      tags: ['forms'],
      summary: 'Get a form (draft document)',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        200: jsonResponse(storedFormDto, 'The stored form'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const row = await forms.get(c.get('workspaceId'), id)
      return row === null ? c.json(NOT_FOUND, 404) : c.json(stored(row), 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'put',
      path: '/forms/{id}',
      tags: ['forms'],
      summary: 'Save the draft document',
      security: [{ bearerAuth: [] }],
      request: { params: idParam, body: jsonBody(updateFormInput) },
      responses: {
        200: jsonResponse(z.object({ ok: z.boolean() }), 'Saved'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const body = c.req.valid('json')
      const saved = await forms.save(
        c.get('workspaceId'),
        id,
        body.doc as unknown as FormDefinition,
      )
      return saved ? c.json({ ok: true }, 200) : c.json(NOT_FOUND, 404)
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/forms/{id}',
      tags: ['forms'],
      summary: 'Delete a form (versions and responses cascade)',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        200: jsonResponse(z.object({ ok: z.boolean() }), 'Deleted'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const removed = await forms.remove(c.get('workspaceId'), id)
      return removed ? c.json({ ok: true }, 200) : c.json(NOT_FOUND, 404)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/forms/{id}/publish',
      tags: ['forms'],
      summary: 'Validate and publish (immutable snapshot)',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        200: jsonResponse(z.object({ version: z.number() }), 'Published version'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
        422: jsonResponse(errorDto, 'The document failed validation'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const row = await forms.get(c.get('workspaceId'), id)
      if (row === null) return c.json(NOT_FOUND, 404)
      const issues = validateFormDocument(row.doc)
      if (issues.length > 0) return c.json({ error: 'invalid', issues }, 422)
      const result = await forms.publish(c.get('workspaceId'), id)
      return result === null ? c.json(NOT_FOUND, 404) : c.json(result, 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/forms/{id}/duplicate',
      tags: ['forms'],
      summary: 'Duplicate a form as a fresh draft',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        201: jsonResponse(storedFormDto, 'The copy'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const row = await forms.duplicate(c.get('workspaceId'), id)
      return row === null ? c.json(NOT_FOUND, 404) : c.json(stored(row), 201)
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms/{id}/versions/{version}',
      tags: ['forms'],
      summary: 'Get an immutable published snapshot',
      security: [{ bearerAuth: [] }],
      request: { params: idParam.extend({ version: z.string() }) },
      responses: {
        200: jsonResponse(z.object({ form: formDoc }), 'The pinned snapshot'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id, version: rawVersion } = c.req.valid('param')
      const version = Number(rawVersion)
      if (!isUuid(id) || !Number.isInteger(version) || version < 1) {
        return c.json(NOT_FOUND, 404)
      }
      const doc = await forms.getSnapshot(c.get('workspaceId'), id, version)
      return doc === null
        ? c.json(NOT_FOUND, 404)
        : c.json({ form: doc as unknown as Record<string, unknown> }, 200)
    },
  )

  /* ---------- responses ---------- */

  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms/{id}/responses',
      tags: ['responses'],
      summary: 'List responses (newest first)',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        200: jsonResponse(z.object({ responses: z.array(responseRowDto) }), 'Responses'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const rows = await responses.list(c.get('workspaceId'), id)
      return c.json({ responses: rows.map(responseJson) }, 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms/{id}/responses/{responseId}',
      tags: ['responses'],
      summary: 'Get one response',
      security: [{ bearerAuth: [] }],
      request: { params: idParam.extend({ responseId: z.string() }) },
      responses: {
        200: jsonResponse(responseRowDto, 'The response'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id, responseId } = c.req.valid('param')
      if (!isUuid(id) || !isUuid(responseId)) return c.json(NOT_FOUND, 404)
      const row = await responses.get(c.get('workspaceId'), id, responseId)
      return row === null ? c.json(NOT_FOUND, 404) : c.json(responseJson(row), 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/forms/{id}/responses/{responseId}',
      tags: ['responses'],
      summary: 'Delete one response',
      security: [{ bearerAuth: [] }],
      request: { params: idParam.extend({ responseId: z.string() }) },
      responses: {
        200: jsonResponse(z.object({ ok: z.boolean() }), 'Deleted'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id, responseId } = c.req.valid('param')
      if (!isUuid(id) || !isUuid(responseId)) return c.json(NOT_FOUND, 404)
      const removed = await responses.remove(c.get('workspaceId'), id, responseId)
      return removed ? c.json({ ok: true }, 200) : c.json(NOT_FOUND, 404)
    },
  )

  /* ---------- api keys (session-only) ---------- */

  app.openapi(
    createRoute({
      method: 'get',
      path: '/api-keys',
      tags: ['api-keys'],
      summary: 'List active API keys with 30-day usage',
      responses: { 200: jsonResponse(z.object({ keys: z.array(apiKeyDto) }), 'Active keys') },
    }),
    async (c) => {
      const workspaceId = c.get('workspaceId')
      const rows = await apiKeys.list(workspaceId)
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)
      const keys = await Promise.all(
        rows.map(async (row) => {
          const usage = await apiKeys.usage(workspaceId, row.id, since)
          return {
            id: row.id,
            name: row.name,
            prefix: row.prefix,
            createdAt: row.createdAt.toISOString(),
            lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
            usage,
            total: usage.reduce((sum, bucket) => sum + bucket.requests, 0),
          }
        }),
      )
      return c.json({ keys }, 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/api-keys',
      tags: ['api-keys'],
      summary: 'Create an API key — the secret is returned ONCE',
      request: { body: jsonBody(createApiKeyInput) },
      responses: {
        201: jsonResponse(
          z.object({
            key: z.object({ id: z.string(), name: z.string(), prefix: z.string() }),
            secret: z.string(),
          }),
          'The key — copy the secret now, it is never shown again',
        ),
      },
    }),
    async (c) => {
      const { name } = c.req.valid('json')
      const material = generateApiKey()
      const row = await apiKeys.create(c.get('workspaceId'), name, material)
      return c.json(
        { key: { id: row.id, name: row.name, prefix: row.prefix }, secret: material.secret },
        201,
      )
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/api-keys/{id}',
      tags: ['api-keys'],
      summary: 'Revoke an API key',
      request: { params: idParam },
      responses: {
        200: jsonResponse(z.object({ ok: z.boolean() }), 'Revoked'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const revoked = await apiKeys.revoke(c.get('workspaceId'), id)
      return revoked ? c.json({ ok: true }, 200) : c.json(NOT_FOUND, 404)
    },
  )

  /* ---------- webhooks (per form) ---------- */

  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms/{id}/webhooks',
      tags: ['webhooks'],
      summary: 'List webhooks with recent delivery history',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        200: jsonResponse(z.object({ webhooks: z.array(webhookDto) }), 'Webhooks'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const workspaceId = c.get('workspaceId')
      // a foreign form must 404, not leak an empty list
      if ((await forms.get(workspaceId, id)) === null) return c.json(NOT_FOUND, 404)
      const rows = await webhooks.list(workspaceId, id)
      const out = await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          url: row.url,
          active: row.active,
          lastStatus: row.lastStatus,
          lastError: row.lastError,
          lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
          deliveries: (await webhooks.deliveries(workspaceId, id, row.id, 10)).map((delivery) => ({
            id: delivery.id,
            event: delivery.event,
            attempt: delivery.attempt,
            status: delivery.status,
            error: delivery.error,
            durationMs: delivery.durationMs,
            createdAt: delivery.createdAt.toISOString(),
          })),
        })),
      )
      return c.json({ webhooks: out }, 200)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/forms/{id}/webhooks',
      tags: ['webhooks'],
      summary: 'Add a webhook — the signing secret is returned ONCE',
      security: [{ bearerAuth: [] }],
      request: { params: idParam, body: jsonBody(createWebhookInput) },
      responses: {
        201: jsonResponse(
          z.object({
            webhook: z.object({ id: z.string(), url: z.string() }),
            secret: z.string(),
          }),
          'The webhook — copy the signing secret now',
        ),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const { url } = c.req.valid('json')
      const secret = generateWebhookSecret()
      const row = await webhooks.create(c.get('workspaceId'), id, url, secret)
      if (row === null) return c.json(NOT_FOUND, 404)
      return c.json({ webhook: { id: row.id, url: row.url }, secret }, 201)
    },
  )

  app.openapi(
    createRoute({
      method: 'delete',
      path: '/forms/{id}/webhooks/{webhookId}',
      tags: ['webhooks'],
      summary: 'Delete a webhook',
      security: [{ bearerAuth: [] }],
      request: { params: idParam.extend({ webhookId: z.string() }) },
      responses: {
        200: jsonResponse(z.object({ ok: z.boolean() }), 'Deleted'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id, webhookId } = c.req.valid('param')
      if (!isUuid(id) || !isUuid(webhookId)) return c.json(NOT_FOUND, 404)
      const removed = await webhooks.remove(c.get('workspaceId'), id, webhookId)
      return removed ? c.json({ ok: true }, 200) : c.json(NOT_FOUND, 404)
    },
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/forms/{id}/webhooks/{webhookId}/test',
      tags: ['webhooks'],
      summary: 'Fire a signed ping at the webhook (single attempt)',
      security: [{ bearerAuth: [] }],
      request: { params: idParam.extend({ webhookId: z.string() }) },
      responses: {
        202: jsonResponse(z.object({ ok: z.boolean() }), 'Ping enqueued'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
        503: jsonResponse(errorDto, 'Queue unavailable'),
      },
    }),
    async (c) => {
      const { id, webhookId } = c.req.valid('param')
      if (!isUuid(id) || !isUuid(webhookId)) return c.json(NOT_FOUND, 404)
      if (deps.queue === undefined) return c.json({ error: 'queue unavailable' }, 503)
      const hook = await webhooks.get(c.get('workspaceId'), id, webhookId)
      if (hook === null) return c.json(NOT_FOUND, 404)
      await deps.queue.send(
        'webhook.deliver',
        { webhookId: hook.id, formId: id, event: 'ping' },
        { retryLimit: 0 },
      )
      return c.json({ ok: true }, 202)
    },
  )

  /* ---------- AI form generation (session-only: the owner's key, the owner's click) ---------- */

  const generateLimiter = createRateLimiter({ windowMs: 3_600_000, max: 10 })

  app.openapi(
    createRoute({
      method: 'post',
      path: '/forms/generate',
      tags: ['forms'],
      summary: 'Generate a draft form from a prompt (AI)',
      request: { body: jsonBody(generateFormInput) },
      responses: {
        201: jsonResponse(storedFormDto, 'The generated DRAFT — review it in the builder'),
        403: jsonResponse(errorDto, 'Session-only'),
        422: jsonResponse(errorDto, 'Generation produced no valid form'),
        429: jsonResponse(errorDto, 'Rate limited'),
        503: jsonResponse(errorDto, 'AI not configured'),
      },
    }),
    async (c) => {
      if (c.get('authVia') !== 'session') return c.json({ error: 'session required' }, 403)
      if (deps.ai === undefined) return c.json({ error: 'ai not configured' }, 503)
      const workspaceId = c.get('workspaceId')
      if (!generateLimiter.allow(workspaceId)) return c.json({ error: 'rate limited' }, 429)
      const { prompt } = c.req.valid('json')
      try {
        const doc = await generateFormDocument(deps.ai.provider, prompt)
        const row = await forms.create(workspaceId, doc, doc.title)
        return c.json(stored(row), 201)
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : 'generation failed' }, 422)
      }
    },
  )

  /* ---------- meta & import ---------- */

  app.openapi(
    createRoute({
      method: 'get',
      path: '/meta',
      tags: ['meta'],
      summary: 'Instance capabilities (drives UI hints)',
      responses: {
        200: jsonResponse(
          z.object({ mailConfigured: z.boolean(), aiConfigured: z.boolean() }),
          'Capabilities',
        ),
      },
    }),
    async (c) =>
      c.json(
        {
          mailConfigured: deps.mail?.configured ?? false,
          aiConfigured: deps.ai !== undefined,
        },
        200,
      ),
  )

  app.openapi(
    createRoute({
      method: 'post',
      path: '/import',
      tags: ['meta'],
      summary: 'Import local-first forms with their published snapshots',
      request: { body: jsonBody(importInput) },
      responses: {
        201: jsonResponse(
          z.object({ imported: z.array(z.object({ sourceId: z.string(), id: z.string() })) }),
          'Imported forms (browser id → server id)',
        ),
      },
    }),
    async (c) => {
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
    },
  )

  /* ---------- the spec itself ---------- */

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    description: 'API key (`fsk_…`) from /settings/api-keys',
  })
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Formsmith API',
      version: '1.0.0',
      description:
        'The Formsmith data plane. Dashboard sessions and bearer API keys share the same routes; submissions are always re-evaluated server-side.',
    },
  })

  return app
}

export type AppType = ReturnType<typeof createApi>

export {
  type DeliverJob,
  type NotifyJob,
  startWorkers,
  WEBHOOK_RETRY,
  type WorkerDeps,
} from './workers'
