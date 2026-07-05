// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { isRealDate, MAX_TEXT_LENGTH } from './validators'

/**
 * Shared Zod schema fragments for the property schemas. Everything here may
 * import Zod freely — this module is deliberately NOT part of the
 * `./runtime` entry (answer validation lives in `validators.ts`).
 */

export { MAX_TEXT_LENGTH }

export const choiceSchema = z.strictObject({
  id: z.string().min(1).max(100),
  label: z.string().min(1).max(500),
})

export const choicesField = z
  .array(choiceSchema)
  .min(1)
  .max(100)
  .refine((choices) => new Set(choices.map((c) => c.id)).size === choices.length, {
    message: 'choice ids must be unique',
  })

export const placeholderField = z.string().max(200).optional()

export const labelField = z.string().max(100).optional()

/** `YYYY-MM-DD` and a real calendar date. Lexicographic order == chronological. */
export const isoDateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO date (YYYY-MM-DD)')
  .refine((value) => isRealDate(value), { message: 'not a real calendar date' })
