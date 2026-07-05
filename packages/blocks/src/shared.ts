// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import type { BlockLike } from './types'

/**
 * Shared schema fragments and answer-validation helpers. Validators are
 * defensive about malformed `properties` (the property schema is the
 * builder/API gate; at answer time we never throw on config junk) and their
 * messages match the engine's established wording exactly.
 */

/** Aligned with the engine's server-side `maxStringLength` submission cap. */
export const MAX_TEXT_LENGTH = 10_000

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

export function isRealDate(value: string): boolean {
  const [y = 0, m = 0, d = 0] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

/** Reads a finite-number property, ignoring config junk. */
export function numberProp(block: BlockLike, key: string): number | undefined {
  const raw = block.properties?.[key]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined
}

export function stringProp(block: BlockLike, key: string): string | undefined {
  const raw = block.properties?.[key]
  return typeof raw === 'string' ? raw : undefined
}

export function choiceIds(block: BlockLike): Set<string> {
  const raw = block.properties?.choices
  const ids = new Set<string>()
  if (Array.isArray(raw)) {
    for (const choice of raw) {
      if (choice !== null && typeof choice === 'object') {
        const id = (choice as { id?: unknown }).id
        if (typeof id === 'string') ids.add(id)
      }
    }
  }
  return ids
}

export function textAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'string') return ['Please enter text.']
  const maxLength = numberProp(block, 'maxLength')
  if (maxLength !== undefined && value.length > maxLength) {
    return [`Please enter at most ${maxLength} characters.`]
  }
  return []
}

export function integerInRange(value: unknown, min: number, max: number): string[] {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return [`Please select a value between ${min} and ${max}.`]
  }
  return []
}
