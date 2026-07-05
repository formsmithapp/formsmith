// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { calcForm, quizForm } from './fixtures'

describe('calculated fields, variables, scoring', () => {
  it('starts variables at their initial values', () => {
    const engine = createEngine(quizForm())
    expect(engine.getState().variables).toEqual({ score: 0 })
  })

  it('adds points as answers land and recomputes idempotently on change', () => {
    const engine = createEngine(quizForm())
    engine.setAnswer('q1', 'four')
    expect(engine.getState().variables.score).toBe(10)

    engine.setAnswer('q1', 'four') // re-answering must not double-add
    expect(engine.getState().variables.score).toBe(10)

    engine.setAnswer('q1', 'three') // correcting to a wrong answer removes the points
    expect(engine.getState().variables.score).toBe(0)

    engine.setAnswer('q1', 'four')
    engine.setAnswer('q2', 'paris')
    engine.setAnswer('q3', 'mars')
    expect(engine.getState().variables.score).toBe(30)
  })

  it('supports `set` with a JSONLogic value expression', () => {
    const engine = createEngine(calcForm())
    expect(engine.getState().variables.total).toBe(0) // number variables default to 0
    engine.setAnswer('qty', 3)
    engine.setAnswer('price', 7)
    expect(engine.getState().variables.total).toBe(21)
    expect(engine.pipe('Total: {{total}}')).toBe('Total: 21')
  })

  it('computeVariables() recomputes and returns the current values', () => {
    const engine = createEngine(quizForm())
    engine.setAnswer('q1', 'four')
    expect(engine.computeVariables()).toEqual({ score: 10 })
  })
})

describe('the scored quiz, end to end (client)', () => {
  const play = (answers: Record<string, string>) => {
    const engine = createEngine(quizForm())
    engine.next() // leave the welcome screen
    for (const ref of ['q1', 'q2', 'q3']) {
      const value = answers[ref]
      if (value !== undefined) engine.setAnswer(ref, value)
      engine.next()
    }
    engine.next() // leave the result statement — the outcome jump fires here
    return engine
  }

  it('a perfect run pipes the score and lands on the pass ending', () => {
    const engine = play({ q1: 'four', q2: 'paris', q3: 'mars' })
    expect(engine.getState().variables.score).toBe(30)
    expect(engine.getCurrentBlock()?.ref).toBe('ending_pass')
    expect(engine.getState().status).toBe('complete')
    expect(engine.pipe(engine.getCurrentBlock()?.title ?? '')).toBe('Great job — 30 points!')
  })

  it('a failing run branches to the fail ending with its own piped copy', () => {
    const engine = play({ q1: 'four', q2: 'london', q3: 'venus' })
    expect(engine.getState().variables.score).toBe(10)
    expect(engine.getCurrentBlock()?.ref).toBe('ending_fail')
    expect(engine.pipe(engine.getCurrentBlock()?.title ?? '')).toBe('Only 10. Try again!')
  })

  it('the result statement pipes the running score', () => {
    const engine = play({ q1: 'four', q2: 'paris', q3: 'venus' })
    // play() already advanced past the statement; recreate the view text directly:
    expect(engine.pipe('You scored {{score}} of 30.')).toBe('You scored 20 of 30.')
  })
})
