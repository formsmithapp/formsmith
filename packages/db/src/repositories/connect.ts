// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { and, desc, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import type { Database } from '../client'
import { apiKeys, apiKeyUsage, forms, webhookDeliveries, webhooks } from '../schema'

/**
 * Connect persistence: API keys (hash-only at rest, usage as daily buckets)
 * and webhooks (attempt history + at-a-glance row state). Same discipline as
 * the rest of the layer: dashboard reads/writes are workspace-scoped;
 * delivery-time paths (findByHash, listActiveByForm, recordAttempt) are the
 * documented unscoped exceptions the service layer owns.
 */

export interface ApiKeyRow {
  id: string
  workspaceId: string
  name: string
  prefix: string
  createdAt: Date
  lastUsedAt: Date | null
  revokedAt: Date | null
}

export interface UsageBucket {
  day: string
  requests: number
}

const keyColumns = {
  id: apiKeys.id,
  workspaceId: apiKeys.workspaceId,
  name: apiKeys.name,
  prefix: apiKeys.prefix,
  createdAt: apiKeys.createdAt,
  lastUsedAt: apiKeys.lastUsedAt,
  revokedAt: apiKeys.revokedAt,
}

export function apiKeysRepository(db: Database) {
  return {
    async create(
      workspaceId: string,
      name: string,
      credentials: { keyHash: string; prefix: string },
    ): Promise<ApiKeyRow> {
      const [row] = await db
        .insert(apiKeys)
        .values({ workspaceId, name, keyHash: credentials.keyHash, prefix: credentials.prefix })
        .returning(keyColumns)
      if (row === undefined) throw new Error('api key insert returned nothing')
      return row
    },

    /** Active keys only — revoked keys stay in the table (audit), not the list. */
    async list(workspaceId: string): Promise<ApiKeyRow[]> {
      return db
        .select(keyColumns)
        .from(apiKeys)
        .where(and(eq(apiKeys.workspaceId, workspaceId), isNull(apiKeys.revokedAt)))
        .orderBy(desc(apiKeys.createdAt))
    },

    async revoke(workspaceId: string, keyId: string): Promise<boolean> {
      const rows = await db
        .update(apiKeys)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, keyId),
            eq(apiKeys.workspaceId, workspaceId),
            isNull(apiKeys.revokedAt),
          ),
        )
        .returning({ id: apiKeys.id })
      return rows.length > 0
    },

    /** The auth path — unscoped by design (the hash IS the credential). */
    async findByHash(keyHash: string): Promise<{ id: string; workspaceId: string } | null> {
      const rows = await db
        .select({ id: apiKeys.id, workspaceId: apiKeys.workspaceId })
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
        .limit(1)
      return rows[0] ?? null
    },

    /** Throttled in SQL: writes at most once a minute per key. */
    async touchLastUsed(keyId: string): Promise<void> {
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(
          and(
            eq(apiKeys.id, keyId),
            sql`(${apiKeys.lastUsedAt} IS NULL OR ${apiKeys.lastUsedAt} < now() - interval '1 minute')`,
          ),
        )
    },

    /** Upsert-increment into the key's daily bucket (metrics, not a log). */
    async recordUsage(keyId: string, day: string): Promise<void> {
      await db
        .insert(apiKeyUsage)
        .values({ apiKeyId: keyId, day, requests: 1 })
        .onConflictDoUpdate({
          target: [apiKeyUsage.apiKeyId, apiKeyUsage.day],
          set: { requests: sql`${apiKeyUsage.requests} + 1` },
        })
    },

    /** Last-N-days buckets for one key (workspace-checked via the key row). */
    async usage(workspaceId: string, keyId: string, sinceDay: string): Promise<UsageBucket[]> {
      const rows = await db
        .select({ day: apiKeyUsage.day, requests: apiKeyUsage.requests })
        .from(apiKeyUsage)
        .innerJoin(apiKeys, eq(apiKeyUsage.apiKeyId, apiKeys.id))
        .where(
          and(
            eq(apiKeyUsage.apiKeyId, keyId),
            eq(apiKeys.workspaceId, workspaceId),
            gte(apiKeyUsage.day, sinceDay),
          ),
        )
        .orderBy(apiKeyUsage.day)
      return rows
    },
  }
}

export interface WebhookRow {
  id: string
  formId: string
  url: string
  secret: string
  active: boolean
  lastStatus: number | null
  lastError: string | null
  lastAttemptAt: Date | null
  createdAt: Date
}

export interface DeliveryRow {
  id: string
  webhookId: string
  event: string
  attempt: number
  status: number | null
  error: string | null
  durationMs: number
  createdAt: Date
}

export function webhooksRepository(db: Database) {
  const scopedWebhook = (workspaceId: string, formId: string, webhookId: string) =>
    and(eq(webhooks.id, webhookId), eq(webhooks.formId, formId), eq(forms.workspaceId, workspaceId))

  return {
    async create(
      workspaceId: string,
      formId: string,
      url: string,
      secret: string,
    ): Promise<WebhookRow | null> {
      const owned = await db
        .select({ id: forms.id })
        .from(forms)
        .where(and(eq(forms.id, formId), eq(forms.workspaceId, workspaceId)))
        .limit(1)
      if (owned.length === 0) return null
      const [row] = await db.insert(webhooks).values({ formId, url, secret }).returning()
      return row ?? null
    },

    async list(workspaceId: string, formId: string): Promise<WebhookRow[]> {
      const rows = await db
        .select({ webhook: webhooks })
        .from(webhooks)
        .innerJoin(forms, eq(webhooks.formId, forms.id))
        .where(and(eq(webhooks.formId, formId), eq(forms.workspaceId, workspaceId)))
        .orderBy(desc(webhooks.createdAt))
      return rows.map((row) => row.webhook)
    },

    async get(workspaceId: string, formId: string, webhookId: string): Promise<WebhookRow | null> {
      const rows = await db
        .select({ webhook: webhooks })
        .from(webhooks)
        .innerJoin(forms, eq(webhooks.formId, forms.id))
        .where(scopedWebhook(workspaceId, formId, webhookId))
        .limit(1)
      return rows[0]?.webhook ?? null
    },

    async remove(workspaceId: string, formId: string, webhookId: string): Promise<boolean> {
      const owned = await this.get(workspaceId, formId, webhookId)
      if (owned === null) return false
      const rows = await db
        .delete(webhooks)
        .where(eq(webhooks.id, webhookId))
        .returning({ id: webhooks.id })
      return rows.length > 0
    },

    /** The submit/worker path — unscoped by design. */
    async listActiveByForm(formId: string): Promise<WebhookRow[]> {
      return db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.formId, formId), eq(webhooks.active, true)))
    },

    /** Worker path: one history row per attempt + the at-a-glance row state. */
    async recordAttempt(
      webhookId: string,
      attempt: {
        event: string
        attempt: number
        status: number | null
        error: string | null
        durationMs: number
      },
    ): Promise<void> {
      await db.insert(webhookDeliveries).values({ webhookId, ...attempt })
      await db
        .update(webhooks)
        .set({
          lastStatus: attempt.status,
          lastError: attempt.error,
          lastAttemptAt: new Date(),
        })
        .where(eq(webhooks.id, webhookId))
    },

    async deliveries(
      workspaceId: string,
      formId: string,
      webhookId: string,
      limit = 10,
    ): Promise<DeliveryRow[]> {
      const rows = await db
        .select({ delivery: webhookDeliveries })
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
        .innerJoin(forms, eq(webhooks.formId, forms.id))
        .where(scopedWebhook(workspaceId, formId, webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(limit)
      return rows.map((row) => row.delivery)
    },

    /** The nightly maintenance job. Returns the pruned-row count. */
    async pruneDeliveries(olderThanDays: number): Promise<number> {
      const rows = await db
        .delete(webhookDeliveries)
        .where(
          lt(webhookDeliveries.createdAt, sql`now() - make_interval(days => ${olderThanDays})`),
        )
        .returning({ id: webhookDeliveries.id })
      return rows.length
    },
  }
}

export type ApiKeysDbRepository = ReturnType<typeof apiKeysRepository>
export type WebhooksDbRepository = ReturnType<typeof webhooksRepository>
