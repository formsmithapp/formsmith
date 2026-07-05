// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { cycleForm, hiddenForm, jumpForm, linearForm, quizForm, visibilityForm } from './fixtures'
import { evaluateSubmission } from './server'
import type { Submission, SubmissionIssueCode } from './types'

const codes = (result: { issues: { code: SubmissionIssueCode }[] }) =>
  result.issues.map((issue) => issue.code)

describe('server re-evaluation: the scored quiz (client → server round trip)', () => {
  const playQuiz = (answers: Record<string, string>) => {
    const engine = createEngine(quizForm())
    engine.next()
    for (const [ref, value] of Object.entries(answers)) {
      engine.setAnswer(ref, value)
      engine.next()
    }
    engine.next()
    return engine
  }

  it('accepts an honest client run and recomputes the same score and ending', () => {
    const client = playQuiz({ q1: 'four', q2: 'paris', q3: 'mars' })
    const state = client.getState()
    const result = evaluateSubmission(quizForm(), {
      answers: state.answers,
      variables: state.variables, // honest client-computed values
    })
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.variables).toEqual({ score: 30 })
    expect(result.ending).toBe('ending_pass')
    expect(result.path).toEqual(['q1', 'q2', 'q3'])
    expect(result.answers).toEqual({ q1: 'four', q2: 'paris', q3: 'mars' })
  })

  it('recomputes a failing run onto the fail ending', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q2: 'london', q3: 'venus' },
    })
    expect(result.ok).toBe(true)
    expect(result.variables).toEqual({ score: 10 })
    expect(result.ending).toBe('ending_fail')
  })

  it('REJECTS a client-tampered score', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q2: 'london', q3: 'venus' }, // honestly worth 10…
      variables: { score: 30 }, // …claimed as 30
    })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('variable_mismatch')
    expect(result.variables).toEqual({ score: 10 }) // the server's number stands
  })

  it('never trusts client variables even when it accepts', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q2: 'paris', q3: 'mars' },
    })
    expect(result.ok).toBe(true)
    expect(result.variables.score).toBe(30) // derived, not copied
  })
})

describe('server re-evaluation: tamper rejection', () => {
  it('required-skip: a required on-path block without an answer', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q3: 'mars' }, // q2 skipped
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'required_skip', ref: 'q2' }),
    )
  })

  it('rule-bypass: an answer to a block hidden by visibility rules', () => {
    const result = evaluateSubmission(visibilityForm(), {
      answers: { have_pet: false, pet_name: 'Rex' }, // pet_name is hidden when have_pet=false
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'rule_bypass', ref: 'pet_name' }),
    )
  })

  it('rule-bypass: an answer to a block jumped over', () => {
    const result = evaluateSubmission(jumpForm(), {
      answers: { plan: 'pro', pro_q: 'ok', basic_q: 'should not be here' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'rule_bypass', ref: 'basic_q' }),
    )
  })

  it('honors the jump path it re-derives (enterprise jumps straight to the ending)', () => {
    const result = evaluateSubmission(jumpForm(), { answers: { plan: 'enterprise' } })
    expect(result.ok).toBe(true)
    expect(result.path).toEqual(['plan'])
    expect(result.ending).toBe('ending')
  })

  it('unknown refs are rejected', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q2: 'paris', q3: 'mars', ghost: 'boo' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_ref', ref: 'ghost' }),
    )
  })

  it('answers to non-answerable screens are rejected', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q2: 'paris', q3: 'mars', intro: 'hello' },
    })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('not_answerable')
  })

  it('unknown client variables are rejected', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'four', q2: 'paris', q3: 'mars' },
      variables: { score: 30, bonus: 1 },
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_ref', ref: 'bonus' }),
    )
  })

  it('oversize: a string answer beyond the limit', () => {
    const result = evaluateSubmission(linearForm(), {
      answers: { name: 'x'.repeat(10_001) },
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'oversize', ref: 'name' }))
  })

  it('oversize: an array answer with too many items', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: Array.from({ length: 101 }, () => 'four') },
    })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('oversize')
  })

  it('oversize: a hidden-field value beyond the limit', () => {
    const result = evaluateSubmission(hiddenForm(), {
      answers: {},
      hiddenFields: { visitor: 'x'.repeat(1_001) },
    })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('oversize')
  })

  it('oversize: the whole submission beyond the total budget', () => {
    const result = evaluateSubmission(
      linearForm(),
      { answers: { name: 'x'.repeat(500) } },
      { limits: { maxTotalBytes: 100 } },
    )
    expect(result.ok).toBe(false)
    expect(codes(result)).toEqual(['oversize'])
  })

  it('undeclared hidden fields are rejected', () => {
    const result = evaluateSubmission(hiddenForm(), {
      answers: {},
      hiddenFields: { tracking_pixel: 'x' },
    })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('unknown_hidden_field')
  })

  it('invalid answers are rejected with the validation message', () => {
    const result = evaluateSubmission(quizForm(), {
      answers: { q1: 'not-a-choice', q2: 'paris', q3: 'mars' },
    })
    expect(result.ok).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'invalid_answer', ref: 'q1' }),
    )
  })

  it('unsupported answer shapes are rejected', () => {
    const result = evaluateSubmission(linearForm(), {
      answers: { name: { $where: 'evil' } },
    })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('invalid_answer')
  })

  it('malformed submissions are rejected outright', () => {
    expect(codes(evaluateSubmission(linearForm(), null as unknown as Submission))).toEqual([
      'malformed',
    ])
    expect(
      codes(evaluateSubmission(linearForm(), { answers: 'hello' } as unknown as Submission)),
    ).toEqual(['malformed'])
  })

  it('a navigation cycle under the submitted answers is rejected', () => {
    const result = evaluateSubmission(cycleForm(), { answers: { a: 'x', b: 'y' } })
    expect(result.ok).toBe(false)
    expect(codes(result)).toContain('cycle')
  })

  it('an empty submission against an all-optional form is accepted', () => {
    const result = evaluateSubmission(visibilityForm(), { answers: { have_pet: false } })
    expect(result.ok).toBe(true)
    expect(result.path).toEqual(['have_pet', 'fav_color'])
    expect(result.ending).toBe('ending')
  })
})
