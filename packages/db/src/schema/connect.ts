// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { forms, workspaces } from './app'

/**
 * The Connect surface (S3): API keys (workspace-scoped, hashed at rest),
 * webhooks (per-form, per-webhook signing secret), and the two history
 * tables that must record from v1 onwards — history can't be captured
 * retroactively.
 */

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** sha256 of the secret — the secret itself is shown once and never stored. */
    keyHash: text('key_hash').notNull().unique(),
    /** First characters (`fsk_…`) for display/identification. */
    prefix: text('prefix').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    /** Revoked, never hard-deleted — the audit trail survives. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [index('api_keys_workspace_idx').on(table.workspaceId)],
)

/** Daily aggregate buckets — the shape a usage dashboard reads. NOT a request log. */
export const apiKeyUsage = pgTable(
  'api_key_usage',
  {
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    requests: integer('requests').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.apiKeyId, table.day] })],
)

export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    /** Per-webhook signing secret (shown once; rotation is EE). */
    secret: text('secret').notNull(),
    active: boolean('active').notNull().default(true),
    /** At-a-glance delivery state; the detail lives in webhook_deliveries. */
    lastStatus: integer('last_status'),
    lastError: text('last_error'),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('webhooks_form_idx').on(table.formId)],
)

/** Row per delivery attempt — pruned after 30 days by the nightly job. */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),
    event: text('event').notNull(),
    attempt: integer('attempt').notNull().default(1),
    /** HTTP status of the attempt; null = the request itself failed. */
    status: integer('status'),
    error: text('error'),
    durationMs: integer('duration_ms').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('webhook_deliveries_webhook_idx').on(table.webhookId, table.createdAt.desc())],
)
