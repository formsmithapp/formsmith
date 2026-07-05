// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Answer validation for every v1 block type — deliberately free of Zod (and
 * any other import) so the respondent runtime can ship these without the
 * property-schema layer. Validators are defensive about malformed
 * `properties` (schemas are the builder/API gate; at answer time we never
 * throw on config junk).
 */

/** The minimal structural view of a block that answer validation needs. */
export interface BlockLike {
  type: string
  required?: boolean
  properties?: Record<string, unknown>
}

/** Aligned with the engine's server-side `maxStringLength` submission cap. */
export const MAX_TEXT_LENGTH = 10_000

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

export function integerInRange(value: unknown, min: number, max: number): string[] {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return [`Please select a value between ${min} and ${max}.`]
  }
  return []
}

export function textAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'string') return ['Please enter text.']
  const maxLength = numberProp(block, 'maxLength')
  if (maxLength !== undefined && value.length > maxLength) {
    return [`Please enter at most ${maxLength} characters.`]
  }
  return []
}

export function multipleChoiceAnswer(value: unknown, block: BlockLike): string[] {
  const ids = choiceIds(block)
  if (block.properties?.multiple === true) {
    if (!Array.isArray(value)) return ['Please select from the available choices.']
    const seen = new Set<string>()
    for (const item of value) {
      if (typeof item !== 'string' || !ids.has(item) || seen.has(item)) {
        return ['Please select from the available choices.']
      }
      seen.add(item)
    }
    return []
  }
  return typeof value === 'string' && ids.has(value) ? [] : ['Please select a valid choice.']
}

export function singleChoiceAnswer(value: unknown, block: BlockLike): string[] {
  return typeof value === 'string' && choiceIds(block).has(value)
    ? []
    : ['Please select a valid choice.']
}

export function yesNoAnswer(value: unknown): string[] {
  return typeof value === 'boolean' ? [] : ['Please select yes or no.']
}

export function legalAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'boolean') return ['Please choose whether you accept.']
  if (block.required && value !== true) return ['Please accept to continue.']
  return []
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function emailAnswer(value: unknown): string[] {
  return typeof value === 'string' && EMAIL_RE.test(value)
    ? []
    : ['Please enter a valid email address.']
}

export function phoneAnswer(value: unknown): string[] {
  if (typeof value === 'string' && /^\+?[0-9\s().-]+$/.test(value)) {
    const digits = value.replace(/\D/g, '')
    if (digits.length >= 5 && digits.length <= 15) return []
  }
  return ['Please enter a valid phone number.']
}

export function websiteAnswer(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') return []
    } catch {
      // falls through to the error below
    }
  }
  return ['Please enter a valid URL (including http:// or https://).']
}

export function numberAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ['Please enter a number.']
  const min = numberProp(block, 'min')
  const max = numberProp(block, 'max')
  const step = numberProp(block, 'step')
  if (min !== undefined && value < min) return [`Value must be at least ${min}.`]
  if (max !== undefined && value > max) return [`Value must be at most ${max}.`]
  if (step !== undefined && step > 0) {
    const ratio = (value - (min ?? 0)) / step
    if (Math.abs(ratio - Math.round(ratio)) > 1e-9) return [`Please use increments of ${step}.`]
  }
  return []
}

export function dateAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isRealDate(value)) {
    return ['Please enter a valid date (YYYY-MM-DD).']
  }
  const min = stringProp(block, 'min')
  const max = stringProp(block, 'max')
  if (min !== undefined && value < min) return [`Please pick a date on or after ${min}.`]
  if (max !== undefined && value > max) return [`Please pick a date on or before ${max}.`]
  return []
}

export function opinionScaleAnswer(value: unknown, block: BlockLike): string[] {
  const min = numberProp(block, 'min') ?? 1
  const max = numberProp(block, 'max') ?? 5
  return integerInRange(value, min, max)
}

export function npsAnswer(value: unknown): string[] {
  return integerInRange(value, 0, 10)
}
