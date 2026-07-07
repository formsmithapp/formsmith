// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { createSummaryFolder, csvHeader, type ResultsResponse, summarize, toCsv } from './results'
import type { FormDefinition } from './types'

const form: FormDefinition = {
  id: 'seed',
  title: 'Feedback',
  blocks: [
    { id: 'b_w', ref: 'welcome', type: 'welcome', title: 'Hi', required: false },
    {
      id: 'b_plan',
      ref: 'plan',
      type: 'multiple_choice',
      title: 'Pick plans',
      required: true,
      properties: {
        choices: [
          { id: 'starter', label: 'Starter' },
          { id: 'pro', label: 'Pro' },
        ],
      },
    },
    { id: 'b_score', ref: 'score', type: 'nps', title: 'Score', required: false },
    { id: 'b_note', ref: 'note', type: 'long_text', title: 'Notes', required: false },
    { id: 'b_end', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
  ],
  logic: [],
  variables: [],
  settings: {},
}

// newest-first, the order both the browser and the server cursor-walk deliver
const responses: ResultsResponse[] = [
  {
    answers: { plan: ['pro', 'starter'], score: 10, note: 'great' },
    submittedAt: '2026-07-07T00:00:03Z',
    formVersion: 1,
  },
  {
    answers: { plan: 'pro', score: 8, note: 'ok' },
    submittedAt: '2026-07-07T00:00:02Z',
    formVersion: 1,
  },
  { answers: { plan: 'starter', note: '' }, submittedAt: '2026-07-07T00:00:01Z', formVersion: 1 },
]

describe('summarize', () => {
  it('counts choices (multi included), aggregates numerics, and excerpts texts', () => {
    const [plan, score, note] = summarize(form, responses)

    expect(plan).toMatchObject({
      kind: 'choices',
      answered: 3,
      options: [
        { label: 'Starter', count: 2 },
        { label: 'Pro', count: 2 },
      ],
    })
    expect(score).toMatchObject({ kind: 'numeric', answered: 2, average: 9, min: 8, max: 10 })
    expect(note).toMatchObject({ kind: 'texts', answered: 2 })
  })
})

describe('createSummaryFolder', () => {
  it('folds batched pages to exactly the same result as summarize()', () => {
    const folder = createSummaryFolder(form)
    // two batches, newest-first, as the cursor-walk would yield them
    folder.add(responses.slice(0, 2))
    folder.add(responses.slice(2))
    const folded = folder.finalize()

    expect(folded.total).toBe(3)
    expect(folded.questions).toEqual(summarize(form, responses))
  })

  it('reports zero total for an empty response set', () => {
    const folded = createSummaryFolder(form).finalize()
    expect(folded.total).toBe(0)
    expect(folded.questions.every((q) => q.answered === 0)).toBe(true)
  })
})

describe('csv export helpers', () => {
  it('header lists answerable refs then submitted_at + version', () => {
    expect(csvHeader(form)).toBe('plan,score,note,submitted_at,version')
  })

  it('toCsv escapes and round-trips raw values', () => {
    const csv = toCsv(form, [
      {
        answers: { plan: 'pro', score: 9, note: 'a, "b"' },
        submittedAt: '2026-07-07T00:00:00Z',
        formVersion: 2,
      },
    ])
    const [, row] = csv.split('\n')
    expect(row).toBe('pro,9,"a, ""b""",2026-07-07T00:00:00Z,2')
  })
})
