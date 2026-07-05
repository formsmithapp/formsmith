// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from 'vitest'
import { createEngine } from './engine'
import { EngineError } from './errors'
import { jumpForm, linearForm } from './fixtures'

describe('linear navigation', () => {
  it('starts on the first block and walks the document in order', () => {
    const engine = createEngine(linearForm())
    expect(engine.getCurrentBlock()?.ref).toBe('intro')

    expect(engine.next().ok).toBe(true) // welcome screens never validate
    expect(engine.getCurrentBlock()?.ref).toBe('name')

    engine.setAnswer('name', 'Ada')
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('email')
  })

  it('blocks next() on a required unanswered block and records errors', () => {
    const engine = createEngine(linearForm())
    engine.next()
    const result = engine.next()
    expect(result.ok).toBe(false)
    expect(result.block?.ref).toBe('name')
    expect(result.errors).toEqual(['This field is required.'])
    expect(engine.getState().errors.name).toEqual(['This field is required.'])

    engine.setAnswer('name', 'Ada')
    expect(engine.getState().errors.name).toBeUndefined() // answering clears the error
    expect(engine.next().ok).toBe(true)
  })

  it('blocks next() on an invalid answer', () => {
    const engine = createEngine(linearForm())
    engine.next()
    engine.setAnswer('name', 'Ada')
    engine.next()
    engine.setAnswer('email', 'not-an-email')
    const result = engine.next()
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(['Please enter a valid email address.'])
  })

  it('passes through statements and completes at the thank-you block', () => {
    const engine = createEngine(linearForm())
    const completed = vi.fn()
    engine.on('complete', completed)

    engine.next()
    engine.setAnswer('name', 'Ada')
    engine.next()
    engine.setAnswer('email', 'ada@lovelace.dev')
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('note')
    engine.next()
    engine.setAnswer('rating', 5)
    engine.next()

    expect(engine.getCurrentBlock()?.ref).toBe('ending')
    expect(engine.getState().status).toBe('complete')
    expect(completed).toHaveBeenCalledExactlyOnceWith({
      answers: { name: 'Ada', email: 'ada@lovelace.dev', rating: 5 },
      variables: {},
    })

    expect(engine.next().ok).toBe(true) // terminal no-op
    expect(engine.getCurrentBlock()?.ref).toBe('ending')
    expect(() => engine.setAnswer('name', 'Eve')).toThrow(EngineError)
  })

  it('prev() retraces visited blocks and stops at the start', () => {
    const engine = createEngine(linearForm())
    expect(engine.prev().ok).toBe(false)

    engine.next()
    engine.setAnswer('name', 'Ada')
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('email')

    expect(engine.prev().ok).toBe(true)
    expect(engine.getCurrentBlock()?.ref).toBe('name')
    expect(engine.prev().ok).toBe(true)
    expect(engine.getCurrentBlock()?.ref).toBe('intro')
    expect(engine.prev().ok).toBe(false)
  })

  it('goTo() accepts a ref or an id and rejects unknown blocks', () => {
    const engine = createEngine(linearForm())
    expect(engine.goTo('email').block?.ref).toBe('email')
    expect(engine.goTo('b_name').block?.ref).toBe('name')
    expect(() => engine.goTo('nope')).toThrow(EngineError)
  })

  it('emits navigate events with from/to ids', () => {
    const engine = createEngine(linearForm())
    const navigated = vi.fn()
    engine.on('navigate', navigated)
    engine.next()
    expect(navigated).toHaveBeenCalledWith({ from: 'b_welcome', to: 'b_name' })
  })

  it('progress counts only answerable blocks', () => {
    const engine = createEngine(linearForm())
    expect(engine.progress()).toEqual({ answered: 0, total: 3, ratio: 0 })

    engine.next()
    engine.setAnswer('name', 'Ada')
    expect(engine.progress()).toEqual({ answered: 1, total: 3, ratio: 1 / 3 })

    engine.setAnswer('email', 'ada@lovelace.dev')
    engine.setAnswer('rating', 4)
    expect(engine.progress()).toEqual({ answered: 3, total: 3, ratio: 1 })
  })

  it('reset() returns to the initial state', () => {
    const engine = createEngine(linearForm())
    engine.next()
    engine.setAnswer('name', 'Ada')
    engine.reset()
    expect(engine.getCurrentBlock()?.ref).toBe('intro')
    expect(engine.getState()).toMatchObject({ answers: {}, history: [], status: 'in_progress' })
  })

  it('edit mode navigates without validation gates', () => {
    const engine = createEngine(linearForm(), { mode: 'edit' })
    engine.next()
    expect(engine.next().ok).toBe(true) // required "name" is empty, but preview roams free
    expect(engine.getCurrentBlock()?.ref).toBe('email')
  })
})

describe('jump navigation', () => {
  const answerPlan = (plan: string) => {
    const engine = createEngine(jumpForm())
    engine.setAnswer('plan', plan)
    engine.next()
    return engine
  }

  it('jumps to the matching target', () => {
    const engine = answerPlan('pro')
    expect(engine.getCurrentBlock()?.ref).toBe('pro_q') // skipped basic_q
  })

  it('falls through in document order when no jump matches', () => {
    const engine = answerPlan('basic')
    expect(engine.getCurrentBlock()?.ref).toBe('basic_q')
    engine.setAnswer('basic_q', 'hi')
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('final_note') // jumped over pro_q
  })

  it('jump-to-ending completes the form', () => {
    const completed = vi.fn()
    const engine = createEngine(jumpForm())
    engine.on('complete', completed)
    engine.setAnswer('plan', 'enterprise')
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('ending')
    expect(engine.getState().status).toBe('complete')
    expect(completed).toHaveBeenCalledTimes(1)
  })

  it('prev() after a jump returns to the block actually visited', () => {
    const engine = answerPlan('pro')
    engine.prev()
    expect(engine.getCurrentBlock()?.ref).toBe('plan') // not basic_q — history, not document order
  })
})
