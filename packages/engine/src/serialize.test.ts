// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { EngineError } from './errors'
import { linearForm, quizForm } from './fixtures'
import type { SerializedEngineState } from './types'

describe('serialize / hydrate', () => {
  it('round-trips a mid-form session into a fresh engine', () => {
    const first = createEngine(quizForm())
    first.next()
    first.setAnswer('q1', 'four')
    first.next()
    first.setAnswer('q2', 'paris')
    const snapshot = first.serialize()

    const second = createEngine(quizForm())
    second.hydrate(snapshot)
    expect(second.getCurrentBlock()?.ref).toBe(first.getCurrentBlock()?.ref)
    expect(second.getState().answers).toEqual({ q1: 'four', q2: 'paris' })
    expect(second.getState().variables).toEqual({ score: 20 })
    expect(second.getState().history).toEqual(first.getState().history)

    // …and the resumed session continues normally.
    second.next()
    expect(second.getCurrentBlock()?.ref).toBe('q3')
  })

  it('serialize() detaches from live state', () => {
    const engine = createEngine(quizForm())
    engine.next()
    const snapshot = engine.serialize()
    snapshot.answers.q1 = 'tampered'
    expect(engine.getState().answers).toEqual({})
  })

  it('hydrate() recomputes variables instead of trusting the snapshot', () => {
    const engine = createEngine(quizForm())
    engine.next()
    engine.setAnswer('q1', 'four')
    const snapshot = engine.serialize()
    snapshot.variables = { score: 999_999 }

    const resumed = createEngine(quizForm())
    resumed.hydrate(snapshot)
    expect(resumed.getState().variables).toEqual({ score: 10 })
  })

  it('hydrate() drops unknown answers and repairs a broken pointer', () => {
    const engine = createEngine(quizForm())
    const snapshot = engine.serialize()
    snapshot.answers = { q1: 'four', bogus: 'x', intro: 'not answerable' }
    snapshot.currentId = 'b_missing'
    snapshot.history = ['b_welcome', 'nope']

    engine.hydrate(snapshot)
    expect(engine.getState().answers).toEqual({ q1: 'four' })
    expect(engine.getCurrentBlock()?.ref).toBe('intro') // repaired to the first visible block
    expect(engine.getState().history).toEqual(['b_welcome'])
  })

  it('hydrate() rejects snapshots for a different form or with a bad shape', () => {
    const engine = createEngine(quizForm())
    const foreign = createEngine(linearForm()).serialize()
    expect(() => engine.hydrate(foreign)).toThrow(EngineError)
    expect(() => engine.hydrate({ hello: 'world' } as unknown as SerializedEngineState)).toThrow(
      EngineError,
    )
  })

  it('a hydrated completed session stays terminal', () => {
    const engine = createEngine(linearForm())
    engine.next()
    engine.setAnswer('name', 'Ada')
    engine.next()
    engine.setAnswer('email', 'ada@lovelace.dev')
    engine.next()
    engine.next()
    engine.setAnswer('rating', 5)
    engine.next()
    expect(engine.getState().status).toBe('complete')

    const resumed = createEngine(linearForm())
    resumed.hydrate(engine.serialize())
    expect(resumed.getState().status).toBe('complete')
    expect(resumed.getCurrentBlock()?.ref).toBe('ending')
    expect(() => resumed.setAnswer('name', 'Eve')).toThrow(EngineError)
  })
})
