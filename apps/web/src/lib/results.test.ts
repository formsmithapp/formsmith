// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { Block, FormDefinition } from '@formsmithapp/engine'
import { describe, expect, it } from 'vitest'
import type { StoredResponse } from './repository/responses'
import { formatAnswer, summarize, toCsv } from './results'

const block = (partial: Partial<Block> & Pick<Block, 'id' | 'ref' | 'type'>): Block => ({
  title: partial.ref,
  required: false,
  ...partial,
})

function snapshot(): FormDefinition {
  return {
    id: 'f1',
    version: 2,
    blocks: [
      block({ id: 'b0', ref: 'welcome', type: 'welcome' }),
      block({
        id: 'b1',
        ref: 'plan',
        type: 'multiple_choice',
        title: 'Pick a plan',
        properties: {
          choices: [
            { id: 'starter', label: 'Starter' },
            { id: 'pro', label: 'Pro' },
          ],
        },
      }),
      block({ id: 'b2', ref: 'nps', type: 'nps', title: 'Recommend us?' }),
      block({ id: 'b3', ref: 'why', type: 'long_text', title: 'Why?' }),
      block({ id: 'b4', ref: 'end', type: 'thankyou' }),
    ],
  }
}

const response = (
  id: string,
  answers: Record<string, unknown>,
  submittedAt = '2026-07-06T10:00:00.000Z',
  formVersion = 2,
): StoredResponse => ({
  id,
  formId: 'f1',
  formVersion,
  submittedAt,
  answers,
  variables: {},
  hidden: {},
  ending: 'end',
})

const RESPONSES = [
  response('r3', { plan: 'pro', nps: 9, why: 'fast, and it respects "privacy"' }),
  response('r2', { plan: 'pro', nps: 7 }),
  response('r1', { plan: 'starter', nps: 9, why: 'multi\nline' }, '2026-07-05T09:00:00.000Z', 1),
]

describe('summarize', () => {
  it('skips screens and aggregates per kind against the latest snapshot', () => {
    const summaries = summarize(snapshot(), RESPONSES)
    expect(summaries.map((s) => s.block.ref)).toEqual(['plan', 'nps', 'why'])

    const [plan, nps, why] = summaries
    expect(plan).toMatchObject({
      kind: 'choices',
      answered: 3,
      options: [
        { label: 'Starter', count: 1 },
        { label: 'Pro', count: 2 },
      ],
    })
    expect(nps).toMatchObject({
      kind: 'numeric',
      answered: 3,
      min: 7,
      max: 9,
      histogram: [
        { value: 7, count: 1 },
        { value: 9, count: 2 },
      ],
    })
    expect(nps?.kind === 'numeric' && Math.abs(nps.average - 25 / 3) < 1e-9).toBe(true)
    expect(why).toMatchObject({ kind: 'texts', answered: 2 })
    expect(why?.kind === 'texts' && why.latest[0]?.text).toContain('privacy')
  })

  it('handles zero responses and refs missing from older versions', () => {
    const summaries = summarize(snapshot(), [])
    expect(summaries.every((s) => s.answered === 0)).toBe(true)
    // an old response lacking the ref entirely is just unanswered
    const partial = summarize(snapshot(), [response('r', { nps: 5 }, undefined, 1)])
    expect(partial[0]?.answered).toBe(0)
    expect(partial[1]?.answered).toBe(1)
  })
})

describe('formatAnswer', () => {
  it('maps choice ids and booleans to labels; arrays join', () => {
    const [, plan] = snapshot().blocks
    if (plan === undefined) throw new Error('fixture')
    expect(formatAnswer(plan, 'pro')).toBe('Pro')
    expect(formatAnswer(plan, ['starter', 'pro'])).toBe('Starter, Pro')
    const yn = block({ id: 'y', ref: 'ok', type: 'yes_no' })
    expect(formatAnswer(yn, true)).toBe('Yes')
    expect(formatAnswer(yn, false)).toBe('No')
    expect(formatAnswer(yn, null)).toBe('')
  })
})

describe('toCsv', () => {
  it('emits refs in document order + submitted_at + version, raw ids, escaped', () => {
    const csv = toCsv(snapshot(), RESPONSES)
    const [header, first] = csv.split('\n')
    expect(header).toBe('plan,nps,why,submitted_at,version')
    expect(first).toBe('pro,9,"fast, and it respects ""privacy""",2026-07-06T10:00:00.000Z,2')
    // multi-line answers stay ONE logical record — the newline lives inside quotes
    expect(csv).toContain('"multi\nline"')
    expect(csv.split('\n')).toHaveLength(5) // 4 records, one containing a quoted newline
  })

  it('missing answers become empty fields', () => {
    const csv = toCsv(snapshot(), [response('r', { nps: 5 })])
    expect(csv.split('\n')[1]).toBe(',5,,2026-07-06T10:00:00.000Z,2')
  })
})
