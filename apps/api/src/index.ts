// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type CacheAdapter,
  InMemoryLruCache,
  type MailAdapter,
  type QueueAdapter,
  safeCache,
} from '@formsmithapp/adapters'
import { generateFollowup, generateFormDocument, type ModelProvider } from '@formsmithapp/ai'
import type { Database } from '@formsmithapp/db'
import {
  apiKeysRepository,
  creditsRepository,
  formsRepository,
  responsesRepository,
  schema,
  webhooksRepository,
  workspaceForUser,
} from '@formsmithapp/db'
import {
  createSubmissionEvaluator,
  createSummaryFolder,
  csvHeader,
  csvRow,
  exportRefs,
  type FormDefinition,
  type ResultsResponse,
  type SubmissionEvaluator,
} from '@formsmithapp/engine'
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
import type { Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { createMiddleware } from 'hono/factory'
import { type ExchangeTuple, signExchange, verifyExchange } from './ai-sign'
import { generateApiKey, generateWebhookSecret, hashApiKey } from './keys'
import { evaluateWith, isUuid, validateFormDocument } from './service'
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
  getSession: (headers: Headers) => Promise<{ userId: string; emailVerified: boolean } | null>
  /** Require a verified email to publish + use AI (v0.1.5). Off by default;
   * when on, unverified SESSION accounts can still build/preview. */
  requireVerifiedEmail?: boolean
  /** Background jobs (webhooks, notifications). Absent → integrations 503. */
  queue?: QueueAdapter
  mail?: MailAdapter
  /** The AI provider chain. Absent → ai_followup blocks run fallback-only. */
  ai?: { provider: ModelProvider }
  /** Signs AI exchanges (incl. the fallback path, which works with AI off).
   * Absent → no exchange loop at all (base questions only). */
  signingSecret?: string
  /** Public submit limit per ip+form per minute (FORMSMITH_SUBMIT_RATE).
   * Default 60 — raise it when many respondents share one NAT'd IP. */
  submitRatePerMinute?: number
  /** Serializable-value cache (snapshots, rate windows, workspace lookups).
   * Absent → an internal in-memory LRU. Wrapped fail-open either way: a
   * broken cache slows requests down, it never fails them. */
  cache?: CacheAdapter
  /** AI credits + workspace quotas (v0.1.5). Every field unset = unlimited
   * (self-host default); the hosted instance passes strict values. */
  quotas?: {
    /** Granted per workspace on first AI charge; unset = unlimited (no ledger). */
    aiCreditsDefault?: number
    /** Credits per AI generation; default 5. Exchanges always cost 1. */
    aiGenerationCost?: number
    forms?: number
    responsesPerMonth?: number
    webhooksPerForm?: number
    apiKeysPerWorkspace?: number
  }
}

interface Env {
  Variables: { workspaceId: string; authVia: 'session' | 'key'; emailVerified: boolean }
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
const responsePageDto = z.object({
  responses: z.array(responseRowDto),
  nextCursor: z.string().nullable(),
})
const listResponsesQuery = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .openapi({ description: 'Page size (1 to 200, default 50)', example: 50 }),
  cursor: z.string().optional().openapi({ description: 'Opaque keyset cursor from nextCursor' }),
})
const summaryBlockDto = z.object({ ref: z.string(), title: z.string(), type: z.string() })
const questionSummaryDto = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('choices'),
    block: summaryBlockDto,
    answered: z.number(),
    options: z.array(z.object({ label: z.string(), count: z.number() })),
  }),
  z.object({
    kind: z.literal('numeric'),
    block: summaryBlockDto,
    answered: z.number(),
    average: z.number(),
    min: z.number(),
    max: z.number(),
    histogram: z.array(z.object({ value: z.number(), count: z.number() })),
  }),
  z.object({
    kind: z.literal('texts'),
    block: summaryBlockDto,
    answered: z.number(),
    latest: z.array(z.object({ text: z.string(), submittedAt: z.string() })),
  }),
])
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
  const credits = creditsRepository(deps.db)

  const todayUtc = () => new Date().toISOString().slice(0, 10)
  const monthUtc = () => new Date().toISOString().slice(0, 7)

  /* ---------- quotas + AI credits (v0.1.5) — every limit unset = unlimited ---------- */

  const AI_EXCHANGE_COST = 1
  const aiGenerationCost = deps.quotas?.aiGenerationCost ?? 5

  /** Spend `cost` credits for `workspaceId`. Returns false ONLY when a credit
   * default is configured AND the ledger is exhausted; unlimited otherwise. */
  const chargeAiCredits = async (workspaceId: string, cost: number): Promise<boolean> => {
    const grant = deps.quotas?.aiCreditsDefault
    if (grant === undefined) return true // unlimited — no ledger consulted
    return (await credits.charge(workspaceId, cost, grant)) !== null
  }

  /** True when `current` count has reached a configured `limit` (create blocked). */
  const atQuota = (current: number, limit: number | undefined): boolean =>
    limit !== undefined && current >= limit

  const quotaError = (resource: string) => ({ error: 'quota_exceeded', resource })

  // Tier 1 — serializable-value cache (fail-open by construction). Backed by
  // the in-memory LRU in v1; a Redis implementation slots in via deps.cache.
  const cache = safeCache(deps.cache ?? new InMemoryLruCache(500))

  // S5 hardening: every surface has a DECIDED ceiling. Fixed-window counters
  // on the cache adapter, so limits go cross-instance the day Redis arrives.
  const overLimit = async (surface: string, key: string, max: number, windowSeconds: number) =>
    (await cache.incr(`fs:rl:${surface}:${key}`, windowSeconds)) > max

  // Tier 2 — compiled snapshot evaluators. Live closures, so NEVER behind the
  // CacheAdapter; published versions are immutable, so no invalidation — just
  // a size bound with LRU refresh.
  const EVALUATOR_MEMO_MAX = 200
  const evaluators = new Map<string, SubmissionEvaluator>()
  const evaluatorFor = (formId: string, version: number, doc: FormDefinition) => {
    const key = `${formId}:${version}`
    const hit = evaluators.get(key)
    if (hit !== undefined) {
      evaluators.delete(key)
      evaluators.set(key, hit)
      return hit
    }
    const compiled = createSubmissionEvaluator(doc)
    evaluators.set(key, compiled)
    if (evaluators.size > EVALUATOR_MEMO_MAX) {
      const oldest = evaluators.keys().next().value
      if (oldest !== undefined) evaluators.delete(oldest)
    }
    return compiled
  }

  /** Every authed request resolves a workspace — 30 s of cache takes a DB
   * round trip off the whole dashboard/API surface (memberships are
   * effectively static in v1's single-user workspaces). */
  const workspaceIdForUser = async (userId: string): Promise<string | null> => {
    const key = `fs:ws-user:${userId}`
    const hit = await cache.get<string>(key)
    if (hit !== null) return hit
    const workspace = await workspaceForUser(deps.db, userId)
    if (workspace === null) return null
    await cache.set(key, workspace.id, 30)
    return workspace.id
  }

  /** Session first, then `Authorization: Bearer fsk_…` — the public REST API. */
  const requireWorkspace = createMiddleware<Env>(async (c, next) => {
    const session = await deps.getSession(c.req.raw.headers)
    if (session !== null) {
      const workspaceId = await workspaceIdForUser(session.userId)
      if (workspaceId === null) return c.json({ error: 'no workspace' }, 403)
      c.set('workspaceId', workspaceId)
      c.set('authVia', 'session')
      c.set('emailVerified', session.emailVerified)
      return next()
    }
    const header = c.req.header('authorization')
    if (header?.startsWith('Bearer fsk_') === true) {
      const key = await apiKeys.findByHash(hashApiKey(header.slice('Bearer '.length)))
      if (key !== null) {
        // generous ceiling per key — protects a self-hoster's box from a
        // runaway script without ever biting a legitimate export
        if (await overLimit('key', key.id, 600, 60)) return c.json({ error: 'rate limited' }, 429)
        c.set('workspaceId', key.workspaceId)
        c.set('authVia', 'key')
        // an API key is a deliberate credential; the verified gate is for the
        // interactive session surface, so key auth is treated as verified
        c.set('emailVerified', true)
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
    const workspaceId = await workspaceIdForUser(session.userId)
    if (workspaceId === null) return c.json({ error: 'no workspace' }, 403)
    c.set('workspaceId', workspaceId)
    c.set('authVia', 'session')
    c.set('emailVerified', session.emailVerified)
    await next()
  })

  /**
   * The verified-email soft gate (v0.1.5 §B). Only bites when the instance
   * requires verification AND this is an unverified interactive session; API
   * keys and the verification-off default sail through. Returns a 403 body to
   * send, or null to proceed.
   */
  const verifiedGate = (c: Context<Env>): { error: string } | null =>
    deps.requireVerifiedEmail === true &&
    c.get('authVia') === 'session' &&
    c.get('emailVerified') !== true
      ? { error: 'email_not_verified' }
      : null

  /** Published-snapshot reads, cached. Version-pinned docs are immutable
   * (long TTL, no invalidation); the latest-pointer lives 60 s — the same
   * staleness the HTTP layer already serves (`Cache-Control: max-age=60`) —
   * and publish/delete bust it for same-instance immediacy. Misses (drafts,
   * unknown ids) are deliberately NOT cached: a 404 must heal the instant a
   * form is published. */
  async function cachedSnapshot(
    formId: string,
    version?: number,
  ): Promise<{ doc: FormDefinition; version: number } | null> {
    if (version !== undefined) {
      const key = `fs:snapshot:${formId}:${version}`
      const hit = await cache.get<FormDefinition>(key)
      if (hit !== null) return { doc: hit, version }
      const rows = await deps.db
        .select({ doc: schema.formVersions.doc })
        .from(schema.formVersions)
        .where(
          and(eq(schema.formVersions.formId, formId), eq(schema.formVersions.version, version)),
        )
        .limit(1)
      const doc = rows[0]?.doc
      if (doc === undefined) return null
      await cache.set(key, doc, 3_600)
      return { doc, version }
    }
    const key = `fs:snapshot-latest:${formId}`
    const hit = await cache.get<{ doc: FormDefinition; version: number }>(key)
    if (hit !== null) return hit
    const doc = await forms.getPublicSnapshot(formId)
    if (doc === null || doc.version === undefined) return null
    const result = { doc, version: doc.version }
    await cache.set(key, result, 60)
    return result
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

  const toResultsResponse = (row: {
    answers: Record<string, unknown>
    submittedAt: Date
    formVersion: number
  }): ResultsResponse => ({
    answers: row.answers,
    submittedAt: row.submittedAt.toISOString(),
    formVersion: row.formVersion,
  })

  /**
   * Resolves a workspace-owned form to its latest published snapshot. Returns
   * null when the form is absent from the workspace (caller answers 404); the
   * inner `snapshot` is null for a form that was never published (no responses,
   * so summary/export are legitimately empty).
   */
  const ownedSnapshot = async (
    workspaceId: string,
    formId: string,
  ): Promise<{ snapshot: FormDefinition | null } | null> => {
    const form = await forms.get(workspaceId, formId)
    if (form === null) return null
    if (form.publishedVersion === null) return { snapshot: null }
    return { snapshot: await forms.getSnapshot(workspaceId, formId, form.publishedVersion) }
  }

  const clientIp = (headers: Headers) =>
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'

  const app = new OpenAPIHono<Env>().basePath(basePath)

  // NOTE: in Hono, `/x/*` also matches `/x` — register each surface ONCE,
  // or the middleware (and usage recording) runs twice per request.
  app.use('/forms/*', requireWorkspace)
  app.use('/import', requireWorkspace)
  app.use('/meta', requireWorkspace)
  app.use('/api-keys/*', requireSession)
  // zod already bounds every field — this stops the 100 MB nonsense before
  // JSON.parse on the unauthenticated surface
  app.use('/f/*', bodyLimit({ maxSize: 1_048_576 }))

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
      const snapshot = await cachedSnapshot(id)
      if (snapshot === null) return c.json(NOT_FOUND, 404)
      c.header('Cache-Control', 'public, max-age=60') // immutable per version
      return c.json({ form: snapshot.doc as unknown as Record<string, unknown> }, 200)
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
        403: jsonResponse(errorDto, 'Form is no longer accepting responses (monthly cap)'),
        404: jsonResponse(errorDto, 'Unknown or unpublished form'),
        422: jsonResponse(errorDto, 'Rejected by server-side re-evaluation'),
        429: jsonResponse(errorDto, 'Rate limited'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const submitMax = deps.submitRatePerMinute ?? 60
      if (await overLimit('submit', `${clientIp(c.req.raw.headers)}:${id}`, submitMax, 60)) {
        return c.json({ error: 'rate limited' }, 429)
      }
      const payload = c.req.valid('json')
      const snapshot = await cachedSnapshot(id, payload.formVersion)
      if (snapshot === null) return c.json(NOT_FOUND, 404)

      // honeypot tripped → accept-and-discard: a 201 indistinguishable from
      // success, nothing stored — silence is the anti-spam
      if (payload._hp !== undefined && payload._hp !== '') {
        console.warn(`[submit] honeypot tripped for form ${id}`)
        return c.json(
          responseJson({
            id: crypto.randomUUID(),
            formId: id,
            formVersion: snapshot.version,
            submittedAt: new Date(),
            answers: payload.answers,
            variables: {},
            hidden: payload.hiddenFields ?? {},
            ending: null,
            aiTrace: null,
          }),
          201,
        )
      }

      const outcome = evaluateWith(evaluatorFor(id, snapshot.version, snapshot.doc), payload)
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

      const stored = await responses.insertMetered(
        {
          formId: id,
          formVersion: snapshot.version,
          answers: outcome.answers,
          variables: outcome.variables,
          hidden: payload.hiddenFields ?? {},
          ending: outcome.ending,
          aiTrace,
        },
        { monthlyCap: deps.quotas?.responsesPerMonth ?? null, month: monthUtc() },
      )
      // over the monthly cap: nothing stored, the form is closed to new responses
      if (!stored.ok) return c.json({ error: 'form_over_capacity' }, 403)
      const row = stored.row

      // integrations are queued post-commit and must never fail the submission
      if (deps.queue !== undefined) {
        try {
          // independent lookups — one round trip of latency, not two
          const [hooks, [formRow]] = await Promise.all([
            webhooks.listActiveByForm(id),
            deps.db
              .select({ doc: schema.forms.doc })
              .from(schema.forms)
              .where(eq(schema.forms.id, id))
              .limit(1),
          ])
          for (const hook of hooks) {
            await deps.queue.send(
              'webhook.deliver',
              { webhookId: hook.id, formId: id, responseId: row.id, event: 'response.created' },
              WEBHOOK_RETRY,
            )
          }
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
      // this endpoint spends the operator's LLM budget
      if (await overLimit('ai', `${clientIp(c.req.raw.headers)}:${id}`, 30, 60)) {
        return c.json({ error: 'rate limited' }, 429)
      }
      const input = c.req.valid('json')
      const secret = deps.signingSecret
      if (secret === undefined) return c.json({ done: true, reason: 'ai_unconfigured' }, 200)

      const snapshot = (await cachedSnapshot(id))?.doc ?? null
      const block = snapshot?.blocks.find((b) => b.ref === input.ref && b.type === 'ai_followup')
      if (snapshot === null || block === undefined) {
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

      // Spend a credit from the FORM OWNER's ledger before the model call.
      // Only when credits are enabled, so the unlimited path skips the lookup.
      // Exhaustion degrades exactly like a missing AI key: seamless fallback.
      if (deps.quotas?.aiCreditsDefault !== undefined) {
        const ownerWorkspace = await forms.workspaceOf(id)
        const charged =
          ownerWorkspace !== null && (await chargeAiCredits(ownerWorkspace, AI_EXCHANGE_COST))
        if (!charged) {
          if (input.index === 1 && properties.fallbackQuestion !== undefined) {
            return issue(properties.fallbackQuestion, fallbackMeta('credits_exhausted'))
          }
          return c.json({ done: true, reason: 'credits_exhausted' }, 200)
        }
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
        403: jsonResponse(errorDto, 'Form quota reached'),
      },
    }),
    async (c) => {
      const body = c.req.valid('json')
      if (body.doc === undefined) return c.json({ error: 'doc is required' }, 400)
      const workspaceId = c.get('workspaceId')
      if (atQuota(await forms.count(workspaceId), deps.quotas?.forms)) {
        return c.json(quotaError('forms'), 403)
      }
      const row = await forms.create(workspaceId, body.doc as unknown as FormDefinition, body.title)
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
      if (removed) await cache.delete(`fs:snapshot-latest:${id}`)
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
        403: jsonResponse(errorDto, 'Email verification required'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
        422: jsonResponse(errorDto, 'The document failed validation'),
      },
    }),
    async (c) => {
      const gate = verifiedGate(c)
      if (gate !== null) return c.json(gate, 403)
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const row = await forms.get(c.get('workspaceId'), id)
      if (row === null) return c.json(NOT_FOUND, 404)
      const issues = validateFormDocument(row.doc)
      if (issues.length > 0) return c.json({ error: 'invalid', issues }, 422)
      const result = await forms.publish(c.get('workspaceId'), id)
      // the new version must serve immediately on this instance
      if (result !== null) await cache.delete(`fs:snapshot-latest:${id}`)
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
      summary: 'List responses (newest first, keyset-paginated)',
      security: [{ bearerAuth: [] }],
      request: { params: idParam, query: listResponsesQuery },
      responses: {
        200: jsonResponse(responsePageDto, 'A page of responses + the next cursor'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const workspaceId = c.get('workspaceId')
      // a foreign form must 404, not leak an empty page (matches summary/export)
      if ((await forms.get(workspaceId, id)) === null) return c.json(NOT_FOUND, 404)
      const { limit, cursor } = c.req.valid('query')
      const page = await responses.list(workspaceId, id, { limit, cursor })
      return c.json(
        { responses: page.responses.map(responseJson), nextCursor: page.nextCursor },
        200,
      )
    },
  )

  // NOTE: `/responses/summary` and `/responses/export` MUST register before
  // `/responses/{responseId}` — Hono matches routes in registration order, so
  // the param route would otherwise swallow these literal paths.
  app.openapi(
    createRoute({
      method: 'get',
      path: '/forms/{id}/responses/summary',
      tags: ['responses'],
      summary: 'Per-question summary over the latest published snapshot',
      security: [{ bearerAuth: [] }],
      request: { params: idParam },
      responses: {
        200: jsonResponse(
          z.object({ total: z.number(), summary: z.array(questionSummaryDto) }),
          'Per-question summary + total response count',
        ),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const workspaceId = c.get('workspaceId')
      const owned = await ownedSnapshot(workspaceId, id)
      if (owned === null) return c.json(NOT_FOUND, 404)
      if (owned.snapshot === null) return c.json({ total: 0, summary: [] }, 200)

      const folder = createSummaryFolder(owned.snapshot)
      for await (const batch of responses.walk(workspaceId, id)) {
        folder.add(batch.map(toResultsResponse))
      }
      const { total, questions } = folder.finalize()
      return c.json({ total, summary: questions }, 200)
    },
  )

  // Plain (non-OpenAPI) route: streams a response body, so it sidesteps the
  // typed-JSON handler contract. `/forms/*` middleware still applies.
  app.get('/forms/:id/responses/export', async (c) => {
    const id = c.req.param('id')
    if (!isUuid(id)) return c.json(NOT_FOUND, 404)
    const workspaceId = c.get('workspaceId')
    const owned = await ownedSnapshot(workspaceId, id)
    if (owned === null) return c.json(NOT_FOUND, 404)

    const format = c.req.query('format') === 'json' ? 'json' : 'csv'
    const snapshot = owned.snapshot
    const encoder = new TextEncoder()
    // One batch enqueued per pull() so the stream honors backpressure: memory
    // stays bounded to a single page + whatever the client has not yet drained.
    const iterator = responses.walk(workspaceId, id)[Symbol.asyncIterator]()

    if (format === 'json') {
      let opened = false
      let first = true
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          if (!opened) {
            controller.enqueue(encoder.encode('['))
            opened = true
          }
          const { value, done } = await iterator.next()
          if (done === true) {
            controller.enqueue(encoder.encode(']'))
            controller.close()
            return
          }
          for (const row of value) {
            controller.enqueue(
              encoder.encode((first ? '' : ',') + JSON.stringify(responseJson(row))),
            )
            first = false
          }
        },
        cancel: () => void iterator.return?.(undefined),
      })
      return new Response(body, {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'content-disposition': `attachment; filename="${id}-responses.json"`,
        },
      })
    }

    const refs = snapshot !== null ? exportRefs(snapshot) : []
    const header = snapshot !== null ? csvHeader(snapshot) : 'submitted_at,version'
    let wroteHeader = false
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (!wroteHeader) {
          controller.enqueue(encoder.encode(header))
          wroteHeader = true
        }
        const { value, done } = await iterator.next()
        if (done === true) {
          controller.close()
          return
        }
        for (const row of value) {
          controller.enqueue(encoder.encode(`\n${csvRow(refs, toResultsResponse(row))}`))
        }
      },
      cancel: () => void iterator.return?.(undefined),
    })
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${id}-responses.csv"`,
      },
    })
  })

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
        403: jsonResponse(errorDto, 'API key quota reached'),
      },
    }),
    async (c) => {
      // gated too, so an unverified account cannot mint a key to publish with
      const gate = verifiedGate(c)
      if (gate !== null) return c.json(gate, 403)
      const workspaceId = c.get('workspaceId')
      if (atQuota(await apiKeys.count(workspaceId), deps.quotas?.apiKeysPerWorkspace)) {
        return c.json(quotaError('api_keys'), 403)
      }
      const { name } = c.req.valid('json')
      const material = generateApiKey()
      const row = await apiKeys.create(workspaceId, name, material)
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
        403: jsonResponse(errorDto, 'Webhook quota reached'),
        404: jsonResponse(errorDto, 'Not found in this workspace'),
      },
    }),
    async (c) => {
      const { id } = c.req.valid('param')
      if (!isUuid(id)) return c.json(NOT_FOUND, 404)
      const workspaceId = c.get('workspaceId')
      // ownership first (foreign form 404s before the quota is consulted)
      if ((await forms.get(workspaceId, id)) === null) return c.json(NOT_FOUND, 404)
      if (atQuota(await webhooks.count(id), deps.quotas?.webhooksPerForm)) {
        return c.json(quotaError('webhooks'), 403)
      }
      const { url } = c.req.valid('json')
      const secret = generateWebhookSecret()
      const row = await webhooks.create(workspaceId, id, url, secret)
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
      const gate = verifiedGate(c)
      if (gate !== null) return c.json(gate, 403)
      if (deps.ai === undefined) return c.json({ error: 'ai not configured' }, 503)
      const workspaceId = c.get('workspaceId')
      if (await overLimit('generate', workspaceId, 10, 3_600)) {
        return c.json({ error: 'rate limited' }, 429)
      }
      if (atQuota(await forms.count(workspaceId), deps.quotas?.forms)) {
        return c.json(quotaError('forms'), 403)
      }
      // generation spends N credits up front; exhaustion is a friendly 403
      if (!(await chargeAiCredits(workspaceId, aiGenerationCost))) {
        return c.json({ error: 'ai_credits_exhausted' }, 403)
      }
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
          z.object({
            mailConfigured: z.boolean(),
            aiConfigured: z.boolean(),
            verificationRequired: z.boolean(),
          }),
          'Capabilities',
        ),
      },
    }),
    async (c) =>
      c.json(
        {
          mailConfigured: deps.mail?.configured ?? false,
          aiConfigured: deps.ai !== undefined,
          verificationRequired: deps.requireVerifiedEmail === true,
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
