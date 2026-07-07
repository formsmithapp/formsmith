// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block, FormDefinition } from './types'

/**
 * Pure results math: aggregation and export, no DOM, no persistence. Shared by
 * the builder Results view and the server summary/export endpoints so the two
 * can never drift. Summaries are computed against the LATEST snapshot's
 * answerable blocks (document order); responses collected under older versions
 * are tolerated (refs that no longer exist are simply not aggregated; missing
 * answers count as unanswered).
 *
 * Generic over a minimal response shape so both the browser's StoredResponse
 * and the db's ResponseRow (once its Date is stringified) satisfy it.
 */

export interface ResultsResponse {
  answers: Record<string, unknown>
  submittedAt: string
  formVersion: number
}

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
  responses: readonly ResultsResponse[],
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

/**
 * A streaming folder for the summary: accumulate responses in newest-first
 * batches (as the db cursor-walk yields them) and finalize once. Keeps the
 * server's memory bounded to the running counts, never the full response set.
 * Same math as `summarize`, just fed incrementally.
 */
export interface FoldedSummary {
  /** Total responses folded, answered or not. */
  total: number
  questions: QuestionSummary[]
}

export function createSummaryFolder(snapshot: FormDefinition) {
  const answerable = snapshot.blocks.filter((block) => !SCREEN_TYPES.has(block.type))
  const choiceCounts = new Map<string, Map<unknown, number>>()
  const choiceAnswered = new Map<string, number>()
  const numericValues = new Map<string, number[]>()
  const textLatest = new Map<string, { text: string; submittedAt: string }[]>()
  const textAnswered = new Map<string, number>()
  let total = 0

  for (const block of answerable) {
    if (CHOICE_TYPES.has(block.type)) {
      choiceCounts.set(block.ref, new Map())
      choiceAnswered.set(block.ref, 0)
    } else if (NUMERIC_TYPES.has(block.type)) {
      numericValues.set(block.ref, [])
    } else {
      textLatest.set(block.ref, [])
      textAnswered.set(block.ref, 0)
    }
  }

  return {
    /** Fold one newest-first batch; call repeatedly as pages arrive. */
    add(batch: readonly ResultsResponse[]): void {
      for (const response of batch) {
        total += 1
        for (const block of answerable) {
          const value = response.answers[block.ref]
          if (!isAnswered(value)) continue

          if (CHOICE_TYPES.has(block.type)) {
            choiceAnswered.set(block.ref, (choiceAnswered.get(block.ref) ?? 0) + 1)
            const counts = choiceCounts.get(block.ref)
            if (counts !== undefined) {
              for (const item of Array.isArray(value) ? value : [value]) {
                counts.set(item, (counts.get(item) ?? 0) + 1)
              }
            }
          } else if (NUMERIC_TYPES.has(block.type)) {
            if (typeof value === 'number' && Number.isFinite(value)) {
              numericValues.get(block.ref)?.push(value)
            }
          } else {
            textAnswered.set(block.ref, (textAnswered.get(block.ref) ?? 0) + 1)
            const latest = textLatest.get(block.ref)
            // batches arrive newest-first, so the first EXCERPT_LIMIT we see win
            if (latest !== undefined && latest.length < EXCERPT_LIMIT) {
              latest.push({ text: formatAnswer(block, value), submittedAt: response.submittedAt })
            }
          }
        }
      }
    },

    finalize(): FoldedSummary {
      const questions = answerable.map((block): QuestionSummary => {
        const summaryBlock: SummaryBlock = {
          ref: block.ref,
          title: block.title !== '' ? block.title : 'Untitled question',
          type: block.type,
        }
        if (CHOICE_TYPES.has(block.type)) {
          const counts = choiceCounts.get(block.ref) ?? new Map()
          return {
            kind: 'choices',
            block: summaryBlock,
            answered: choiceAnswered.get(block.ref) ?? 0,
            options: optionsOf(block).map((option) => ({
              label: option.label,
              count: counts.get(option.value) ?? 0,
            })),
          }
        }
        if (NUMERIC_TYPES.has(block.type)) {
          const numbers = numericValues.get(block.ref) ?? []
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
          answered: textAnswered.get(block.ref) ?? 0,
          latest: textLatest.get(block.ref) ?? [],
        }
      })
      return { total, questions }
    },
  }
}

/* ---------- export ---------- */

export function csvField(value: unknown): string {
  if (value === undefined || value === null) return ''
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** The answerable refs of the latest snapshot, in document order. */
export const exportRefs = (snapshot: FormDefinition): string[] =>
  snapshot.blocks.filter((block) => !SCREEN_TYPES.has(block.type)).map((block) => block.ref)

/** The CSV header row for a snapshot: answerable refs + submitted_at + version. */
export const csvHeader = (snapshot: FormDefinition): string =>
  [...exportRefs(snapshot), 'submitted_at', 'version'].map(csvField).join(',')

/** One CSV data row for a response (raw answer values, round-trippable). */
export function csvRow(refs: readonly string[], response: ResultsResponse): string {
  return [
    ...refs.map((ref) => csvField(response.answers[ref])),
    response.submittedAt,
    String(response.formVersion),
  ].join(',')
}

/**
 * CSV: latest-snapshot answerable refs in document order + submitted_at +
 * version. Raw answer values (choice ids, not labels) — round-trippable.
 */
export function toCsv(snapshot: FormDefinition, responses: readonly ResultsResponse[]): string {
  const refs = exportRefs(snapshot)
  return [csvHeader(snapshot), ...responses.map((response) => csvRow(refs, response))].join('\n')
}

export function toJson(responses: readonly unknown[]): string {
  return JSON.stringify(responses, null, 2)
}
