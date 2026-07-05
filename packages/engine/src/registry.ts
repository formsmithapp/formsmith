// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block } from './types'

/**
 * The runtime subset of the block-type contract: whether a block collects an answer,
 * and its intrinsic value validation. Property schemas and builder defaults belong to
 * the blocks package; `createEngine({ registry })` is the seam that joins them.
 */
export interface BlockTypeDef {
  type: string
  isAnswerable: boolean
  /** Intrinsic type/shape check for a non-empty value. Returns messages; `[]` means valid. */
  validate?: (value: unknown, block: Block) => string[]
}

export type BlockRegistry = ReadonlyMap<string, BlockTypeDef>

/** Empty means unanswered: `undefined`, `null`, `''`, or `[]`. (`false` is a real answer.) */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (value === '') return true
  return Array.isArray(value) && value.length === 0
}

interface Choice {
  id: string
  label?: string
}

function choiceIds(block: Block): Set<string> {
  const raw = block.properties?.choices
  const ids = new Set<string>()
  if (Array.isArray(raw)) {
    for (const choice of raw) {
      if (
        choice !== null &&
        typeof choice === 'object' &&
        typeof (choice as Choice).id === 'string'
      ) {
        ids.add((choice as Choice).id)
      }
    }
  }
  return ids
}

function numberProp(block: Block, key: string, fallback: number): number {
  const raw = block.properties?.[key]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : fallback
}

const text = (value: unknown): string[] => (typeof value === 'string' ? [] : ['Please enter text.'])

function integerInRange(value: unknown, min: number, max: number): string[] {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    return [`Please select a value between ${min} and ${max}.`]
  }
  return []
}

function choiceAnswer(value: unknown, block: Block): string[] {
  const ids = choiceIds(block)
  const multiple = block.properties?.multiple === true
  if (multiple) {
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

function singleChoice(value: unknown, block: Block): string[] {
  return typeof value === 'string' && choiceIds(block).has(value)
    ? []
    : ['Please select a valid choice.']
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function email(value: unknown): string[] {
  return typeof value === 'string' && EMAIL_RE.test(value)
    ? []
    : ['Please enter a valid email address.']
}

function phone(value: unknown): string[] {
  if (typeof value === 'string' && /^\+?[0-9\s().-]+$/.test(value)) {
    const digits = value.replace(/\D/g, '')
    if (digits.length >= 5 && digits.length <= 15) return []
  }
  return ['Please enter a valid phone number.']
}

function website(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      const url = new URL(value)
      if (url.protocol === 'http:' || url.protocol === 'https:') return []
    } catch {
      // fall through to the error below
    }
  }
  return ['Please enter a valid URL (including http:// or https://).']
}

function finiteNumber(value: unknown): string[] {
  return typeof value === 'number' && Number.isFinite(value) ? [] : ['Please enter a number.']
}

function isoDate(value: unknown): string[] {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y = 0, m = 0, d = 0] = value.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d))
    if (date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d) {
      return []
    }
  }
  return ['Please enter a valid date (YYYY-MM-DD).']
}

function yesNo(value: unknown): string[] {
  return typeof value === 'boolean' ? [] : ['Please select yes or no.']
}

function legal(value: unknown, block: Block): string[] {
  if (typeof value !== 'boolean') return ['Please choose whether you accept.']
  if (block.required && value !== true) return ['Please accept to continue.']
  return []
}

function opinionScale(value: unknown, block: Block): string[] {
  return integerInRange(value, numberProp(block, 'min', 1), numberProp(block, 'max', 5))
}

const nps = (value: unknown): string[] => integerInRange(value, 0, 10)

const V1_TYPES: BlockTypeDef[] = [
  { type: 'short_text', isAnswerable: true, validate: text },
  { type: 'long_text', isAnswerable: true, validate: text },
  { type: 'multiple_choice', isAnswerable: true, validate: choiceAnswer },
  { type: 'dropdown', isAnswerable: true, validate: singleChoice },
  { type: 'yes_no', isAnswerable: true, validate: yesNo },
  { type: 'legal', isAnswerable: true, validate: legal },
  { type: 'email', isAnswerable: true, validate: email },
  { type: 'phone', isAnswerable: true, validate: phone },
  { type: 'website', isAnswerable: true, validate: website },
  { type: 'number', isAnswerable: true, validate: finiteNumber },
  { type: 'date', isAnswerable: true, validate: isoDate },
  { type: 'opinion_scale', isAnswerable: true, validate: opinionScale },
  { type: 'nps', isAnswerable: true, validate: nps },
  { type: 'ai_followup', isAnswerable: true, validate: text },
  { type: 'welcome', isAnswerable: false },
  { type: 'statement', isAnswerable: false },
  { type: 'thankyou', isAnswerable: false },
]

export function createDefaultRegistry(extra?: Iterable<BlockTypeDef>): Map<string, BlockTypeDef> {
  const registry = new Map<string, BlockTypeDef>()
  for (const def of V1_TYPES) registry.set(def.type, def)
  if (extra) for (const def of extra) registry.set(def.type, def)
  return registry
}
