// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { MailAdapter, QueueAdapter } from '@formsmithapp/adapters'
import { type Database, schema, webhooksRepository } from '@formsmithapp/db'
import { and, eq } from 'drizzle-orm'
import { signWebhookPayload } from './signature'

/**
 * Background workers — one story for both deployment shapes: the unified
 * build starts these from Next's instrumentation hook, the standalone server
 * from its entry. Delivery failures THROW so pg-boss retries with backoff;
 * every attempt lands in webhook_deliveries either way.
 */

export interface WorkerDeps {
  db: Database
  queue: QueueAdapter
  mail: MailAdapter
  /** Absolute origin for links in notification emails. */
  baseUrl: string
}

export interface DeliverJob {
  webhookId: string
  formId: string
  event: 'response.created' | 'ping'
  responseId?: string
}

export interface NotifyJob {
  formId: string
  responseId: string
}

const DELIVERY_TIMEOUT_MS = 10_000
export const WEBHOOK_RETRY = { retryLimit: 5, retryBackoff: true, retryDelaySeconds: 60 }

export async function startWorkers(deps: WorkerDeps): Promise<void> {
  const { db, queue, mail, baseUrl } = deps
  const webhooks = webhooksRepository(db)

  await queue.work('webhook.deliver', async (raw, meta) => {
    const job = raw as DeliverJob
    const [hook] = await db
      .select()
      .from(schema.webhooks)
      .where(and(eq(schema.webhooks.id, job.webhookId), eq(schema.webhooks.active, true)))
      .limit(1)
    if (hook === undefined) return // deleted/deactivated since enqueue — not an error

    const [form] = await db
      .select({ id: schema.forms.id, title: schema.forms.title })
      .from(schema.forms)
      .where(eq(schema.forms.id, job.formId))
      .limit(1)

    let response: Record<string, unknown> | undefined
    if (job.responseId !== undefined) {
      const [row] = await db
        .select()
        .from(schema.responses)
        .where(eq(schema.responses.id, job.responseId))
        .limit(1)
      if (row !== undefined) {
        response = {
          id: row.id,
          formVersion: row.formVersion,
          submittedAt: row.submittedAt.toISOString(),
          answers: row.answers,
          variables: row.variables,
          hidden: row.hidden,
          ending: row.ending,
        }
      }
    }

    const body = JSON.stringify({
      event: job.event,
      form: { id: form?.id ?? job.formId, title: form?.title ?? '' },
      ...(response !== undefined ? { response } : {}),
    })
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = signWebhookPayload(hook.secret, body, timestamp)

    const started = Date.now()
    let status: number | null = null
    let error: string | null = null
    try {
      const res = await fetch(hook.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-formsmith-event': job.event,
          'x-formsmith-webhook-id': hook.id,
          'x-formsmith-signature': signature,
        },
        body,
        signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
      })
      status = res.status
      if (!res.ok) error = `HTTP ${res.status}`
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'request failed'
    }
    await webhooks.recordAttempt(hook.id, {
      event: job.event,
      attempt: meta.attempt,
      status,
      error,
      durationMs: Date.now() - started,
    })
    if (error !== null) throw new Error(error) // pg-boss retries
  })

  await queue.work('email.notify', async (raw) => {
    if (!mail.configured) return
    const job = raw as NotifyJob
    const [form] = await db
      .select({
        id: schema.forms.id,
        title: schema.forms.title,
        workspaceId: schema.forms.workspaceId,
      })
      .from(schema.forms)
      .where(eq(schema.forms.id, job.formId))
      .limit(1)
    if (form === undefined) return

    const [owner] = await db
      .select({ email: schema.user.email })
      .from(schema.memberships)
      .innerJoin(schema.user, eq(schema.memberships.userId, schema.user.id))
      .where(
        and(
          eq(schema.memberships.workspaceId, form.workspaceId),
          eq(schema.memberships.role, 'owner'),
        ),
      )
      .limit(1)
    if (owner === undefined) return

    const link = `${baseUrl}/forms/${form.id}/results`
    await mail.send({
      to: owner.email,
      subject: `New response — ${form.title}`,
      text: `Your form "${form.title}" just received a new response.\n\nView it: ${link}\n\n— Formsmith`,
    })
  })

  await queue.work('maintenance.prune', async () => {
    const pruned = await webhooks.pruneDeliveries(30)
    if (pruned > 0) console.log(`[maintenance] pruned ${pruned} webhook deliveries`)
  })
  await queue.schedule('maintenance.prune', '0 3 * * *')
}
