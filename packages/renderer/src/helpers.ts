// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block, FormEngine } from '@formsmithapp/engine'

/**
 * Choice/scale plumbing shared by the answer controls and the global
 * keyboard controller (letter keys, digit keys). Pure view mapping — the
 * engine stays the only authority on values and navigation.
 */

export interface ChoiceItem {
  id: string
  label: string
}

const YES_NO_CHOICES: ChoiceItem[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
]

const LEGAL_CHOICES: ChoiceItem[] = [
  { id: 'accept', label: 'I accept' },
  { id: 'decline', label: "I don't accept" },
]

export function isChoiceLike(block: Block): boolean {
  return block.type === 'multiple_choice' || block.type === 'yes_no' || block.type === 'legal'
}

export function choicesOf(block: Block): ChoiceItem[] {
  if (block.type === 'yes_no') return YES_NO_CHOICES
  if (block.type === 'legal') return LEGAL_CHOICES
  const raw = block.properties?.choices
  if (!Array.isArray(raw)) return []
  const items: ChoiceItem[] = []
  for (const entry of raw) {
    if (entry !== null && typeof entry === 'object') {
      const { id, label } = entry as { id?: unknown; label?: unknown }
      if (typeof id === 'string') items.push({ id, label: typeof label === 'string' ? label : id })
    }
  }
  return items
}

export function isMultiSelect(block: Block): boolean {
  return block.type === 'multiple_choice' && block.properties?.multiple === true
}

export function selectedChoiceIds(block: Block, value: unknown): Set<string> {
  if (block.type === 'yes_no') {
    return typeof value === 'boolean' ? new Set([value ? 'yes' : 'no']) : new Set()
  }
  if (block.type === 'legal') {
    return typeof value === 'boolean' ? new Set([value ? 'accept' : 'decline']) : new Set()
  }
  if (isMultiSelect(block)) {
    return new Set(
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [],
    )
  }
  return typeof value === 'string' ? new Set([value]) : new Set()
}

/**
 * Applies a choice tap/keypress to the engine. Returns true when the pick
 * should auto-advance (single-select semantics, per the interaction catalogue).
 */
export function commitChoice(engine: FormEngine, block: Block, id: string): boolean {
  if (block.type === 'yes_no') {
    engine.setAnswer(block.ref, id === 'yes')
    return true
  }
  if (block.type === 'legal') {
    engine.setAnswer(block.ref, id === 'accept')
    return true
  }
  if (isMultiSelect(block)) {
    const current = selectedChoiceIds(block, engine.getState().answers[block.ref])
    if (current.has(id)) current.delete(id)
    else current.add(id)
    engine.setAnswer(block.ref, current.size > 0 ? [...current] : undefined)
    return false
  }
  engine.setAnswer(block.ref, id)
  return true
}

export function scaleRange(block: Block): { min: number; max: number } | null {
  if (block.type === 'nps') return { min: 0, max: 10 }
  if (block.type === 'opinion_scale') {
    const raw = block.properties ?? {}
    const min = typeof raw.min === 'number' && Number.isFinite(raw.min) ? raw.min : 1
    const max = typeof raw.max === 'number' && Number.isFinite(raw.max) ? raw.max : 5
    return { min, max }
  }
  return null
}

/** Letter for the nth choice tile: A…Z (choices beyond 26 get no key). */
export function letterFor(index: number): string | null {
  return index < 26 ? String.fromCharCode(65 + index) : null
}

/** After a single-select pick, advance once the press settles (catalogue: 260ms). */
export function scheduleAdvance(engine: FormEngine, fromBlockId: string, delayMs = 260): void {
  setTimeout(() => {
    const state = engine.getState()
    if (state.status === 'in_progress' && state.currentId === fromBlockId) engine.next()
  }, delayMs)
}
