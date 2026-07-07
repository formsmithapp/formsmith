// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

/**
 * The v1 application tables — Workspace → Forms → Responses, workspace-scoped
 * from day 1 (v1 §9: the memberships table exists; roles UI is EE). The
 * `form_versions` table is INSERT-ONLY: published snapshots are immutable,
 * exactly the semantic the builder's localStorage keys rehearsed.
 */

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  /** Abuse kill switch: when true, none of this workspace's forms serve or
   * accept responses. Flipped via SQL runbook (no admin UI in v1). */
  suspended: boolean('suspended').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const memberships = pgTable(
  'memberships',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Roles beyond 'owner' arrive with Pro/EE — the schema doesn't change. */
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.workspaceId] }),
    index('memberships_workspace_idx').on(table.workspaceId),
  ],
)

export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: text('title').notNull().default('Untitled form'),
    /** The DRAFT document. Published snapshots live in form_versions. */
    doc: jsonb('doc').$type<FormDefinition>().notNull(),
    status: text('status', { enum: ['draft', 'published'] })
      .notNull()
      .default('draft'),
    publishedVersion: integer('published_version'),
    /** Abuse kill switch for a single form (see workspaces.suspended). */
    suspended: boolean('suspended').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('forms_workspace_idx').on(table.workspaceId)],
)

export const formVersions = pgTable(
  'form_versions',
  {
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    doc: jsonb('doc').$type<FormDefinition>().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.formId, table.version] })],
)

export const responses = pgTable(
  'responses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    formVersion: integer('form_version').notNull(),
    answers: jsonb('answers').$type<Record<string, unknown>>().notNull(),
    /** Server-recomputed — never the client's claim. */
    variables: jsonb('variables').$type<Record<string, unknown>>().notNull(),
    hidden: jsonb('hidden').$type<Record<string, string>>().notNull().default({}),
    ending: text('ending'),
    /** Verified AI exchange transcript + decisions (S4). Null = no AI on the path. */
    aiTrace: jsonb('ai_trace').$type<unknown[]>(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('responses_form_submitted_idx').on(table.formId, table.submittedAt.desc()),
    uniqueIndex('responses_id_form_idx').on(table.id, table.formId),
  ],
)

/**
 * AI credit ledger (v0.1.5). One row per workspace, present ONLY when the
 * instance sets `FORMSMITH_AI_CREDITS_DEFAULT` (self-host default: unset =
 * unlimited, no row, feature off). The row is lazily ensured on the first
 * charge and decremented atomically; billing state must fail CLOSED, so this
 * lives in Postgres, never the fail-open cache.
 */
export const workspaceAiCredits = pgTable('workspace_ai_credits', {
  workspaceId: uuid('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  remaining: integer('remaining').notNull(),
  granted: integer('granted').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Per-form monthly response counter (v0.1.5). Upsert-incremented inside the
 * submit transaction to enforce `FORMSMITH_LIMIT_RESPONSES_MONTH`; the bucket
 * shape mirrors `api_key_usage`. `month` is a 'YYYY-MM' UTC string.
 */
export const formUsage = pgTable(
  'form_usage',
  {
    formId: uuid('form_id')
      .notNull()
      .references(() => forms.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    responses: integer('responses').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.formId, table.month] })],
)
