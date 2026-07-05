// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block, FormDefinition } from '@formsmithapp/engine'
import type { StoredResponse } from './repository/responses'

/**
 * Pure results math — aggregation and export, no DOM. Summaries are computed
 * against the LATEST snapshot's answerable blocks (document order); responses
 * collected under older versions are tolerated (refs that no longer exist are
 * simply not aggregated; missing answers count as unanswered).
 */

const SCREEN_TYPES = new Set(['welcome', 'statement', 'thankyou'])
const CHOICE_TYPES = new Set(['multiple_choice', 'dropdown', 'yes_no', 'legal'])
const NUMERIC_TYPES = new Set(['number', 'opinion_scale', 'nps'])

interface ChoiceProperty {
  id: string
  label: string
}

const choicesOf = (block: Block): ChoiceProperty[] =>
  Array.isArray(block.properties?.choices) ? (block.properties.choices as ChoiceProperty[]) : []

/** The selectable options of a choice-like block, boolean types included. */
function optionsOf(block: Block): { value: unknown; label: string }[] {
  if (block.type === 'yes_no') {
    return [
      { value: true, label: 'Yes' },
      { value: false, label: 'No' },
    ]
  }
  if (block.type === 'legal') {
    return [
      { value: true, label: 'Accepted' },
      { value: false, label: 'Declined' },
    ]
  }
  return choicesOf(block).map((choice) => ({ value: choice.id, label: choice.label }))
}

export const isAnswered = (value: unknown): boolean =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  !(Array.isArray(value) && value.length === 0)

/** Human-readable answer (choice ids → labels, booleans → their option labels). */
export function formatAnswer(block: Block, value: unknown): string {
  if (!isAnswered(value)) return ''
  if (CHOICE_TYPES.has(block.type)) {
    const options = optionsOf(block)
    const label = (v: unknown) => options.find((o) => o.value === v)?.label ?? String(v)
    return Array.isArray(value) ? value.map(label).join(', ') : label(value)
  }
  return Array.isArray(value) ? value.join(', ') : String(value)
}

export interface SummaryBlock {
  ref: string
  title: string
  type: string
}

export type QuestionSummary =
  | {
      kind: 'choices'
      block: SummaryBlock
      answered: number
      options: { label: string; count: number }[]
    }
  | {
      kind: 'numeric'
      block: SummaryBlock
      answered: number
      average: number
      min: number
      max: number
      histogram: { value: number; count: number }[]
    }
  | {
      kind: 'texts'
      block: SummaryBlock
      answered: number
      latest: { text: string; submittedAt: string }[]
    }

const EXCERPT_LIMIT = 5

export function summarize(
  snapshot: FormDefinition,
  responses: readonly StoredResponse[],
): QuestionSummary[] {
  const answerable = snapshot.blocks.filter((block) => !SCREEN_TYPES.has(block.type))
  return answerable.map((block) => {
    const summaryBlock: SummaryBlock = {
      ref: block.ref,
      title: block.title !== '' ? block.title : 'Untitled question',
      type: block.type,
    }
    const values = responses
      .map((response) => ({
        value: response.answers[block.ref],
        submittedAt: response.submittedAt,
      }))
      .filter((entry) => isAnswered(entry.value))

    if (CHOICE_TYPES.has(block.type)) {
      const options = optionsOf(block)
      const counts = new Map<unknown, number>()
      for (const { value } of values) {
        for (const item of Array.isArray(value) ? value : [value]) {
          counts.set(item, (counts.get(item) ?? 0) + 1)
        }
      }
      return {
        kind: 'choices',
        block: summaryBlock,
        answered: values.length,
        options: options.map((option) => ({
          label: option.label,
          count: counts.get(option.value) ?? 0,
        })),
      }
    }

    if (NUMERIC_TYPES.has(block.type)) {
      const numbers = values
        .map((entry) => entry.value)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
      const histogram = new Map<number, number>()
      for (const value of numbers) histogram.set(value, (histogram.get(value) ?? 0) + 1)
      const sum = numbers.reduce((acc, value) => acc + value, 0)
      return {
        kind: 'numeric',
        block: summaryBlock,
        answered: numbers.length,
        average: numbers.length > 0 ? sum / numbers.length : 0,
        min: numbers.length > 0 ? Math.min(...numbers) : 0,
        max: numbers.length > 0 ? Math.max(...numbers) : 0,
        histogram: [...histogram.entries()]
          .sort(([a], [b]) => a - b)
          .map(([value, count]) => ({ value, count })),
      }
    }

    return {
      kind: 'texts',
      block: summaryBlock,
      answered: values.length,
      latest: values.slice(0, EXCERPT_LIMIT).map((entry) => ({
        text: formatAnswer(block, entry.value),
        submittedAt: entry.submittedAt,
      })),
    }
  })
}

/* ---------- export ---------- */

function csvField(value: unknown): string {
  if (value === undefined || value === null) return ''
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/**
 * CSV: latest-snapshot answerable refs in document order + submitted_at +
 * version. Raw answer values (choice IDS, not labels) — round-trippable.
 */
export function toCsv(snapshot: FormDefinition, responses: readonly StoredResponse[]): string {
  const refs = snapshot.blocks
    .filter((block) => !SCREEN_TYPES.has(block.type))
    .map((block) => block.ref)
  const header = [...refs, 'submitted_at', 'version']
  const rows = responses.map((response) => [
    ...refs.map((ref) => csvField(response.answers[ref])),
    response.submittedAt,
    String(response.formVersion),
  ])
  return [header.map(csvField).join(','), ...rows.map((row) => row.join(','))].join('\n')
}

export function toJson(responses: readonly StoredResponse[]): string {
  return JSON.stringify(responses, null, 2)
}
