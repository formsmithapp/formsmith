// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { forms, responses } from './schema'

export { createDb, type Database, ping } from './client'
export { type MigrateOptions, runMigrations } from './migrate'
export {
  type ApiKeyRow,
  type ApiKeysDbRepository,
  apiKeysRepository,
  type DeliveryRow,
  type UsageBucket,
  type WebhookRow,
  type WebhooksDbRepository,
  webhooksRepository,
} from './repositories/connect'
export {
  type CreditState,
  type CreditsDbRepository,
  creditsRepository,
} from './repositories/credits'
export {
  type FormRow,
  type FormsDbRepository,
  formsRepository,
} from './repositories/forms'
export {
  DEFAULT_LIMIT,
  type ListOptions,
  MAX_LIMIT,
  type NewResponse,
  type ResponsePage,
  type ResponseRow,
  type ResponsesDbRepository,
  responsesRepository,
} from './repositories/responses'
export { createWorkspaceWithOwner, workspaceForUser } from './repositories/workspaces'
export * as schema from './schema'

/** Row schemas derived from the tables (drizzle-zod) — they cannot drift. */
export const selectFormRow = createSelectSchema(forms)
export const insertResponseRow = createInsertSchema(responses)
export const selectResponseRow = createSelectSchema(responses)
