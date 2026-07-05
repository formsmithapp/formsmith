// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it, vi } from 'vitest'
import { createEngine } from './engine'
import { linearForm } from './fixtures'
import { createStore } from './store'

describe('createStore', () => {
  it('returns the current snapshot and notifies subscribers on change', () => {
    const store = createStore({ n: 0 })
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    expect(store.getState()).toEqual({ n: 0 })
    store.setState({ n: 1 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getState()).toEqual({ n: 1 })

    unsubscribe()
    store.setState({ n: 2 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('supports multiple independent subscribers', () => {
    const store = createStore(0)
    const a = vi.fn()
    const b = vi.fn()
    store.subscribe(a)
    const unsubscribeB = store.subscribe(b)
    store.setState(1)
    unsubscribeB()
    store.setState(2)
    expect(a).toHaveBeenCalledTimes(2)
    expect(b).toHaveBeenCalledTimes(1)
  })
})

describe('engine as a reactive store (the framework bridge contract)', () => {
  it('getState returns an identical snapshot until something changes', () => {
    const engine = createEngine(linearForm())
    const first = engine.getState()
    expect(engine.getState()).toBe(first)
    engine.next() // past the welcome screen
    engine.setAnswer('name', 'Ada')
    const second = engine.getState()
    expect(second).not.toBe(first)
    expect(engine.getState()).toBe(second)
  })

  it('notifies on answers and navigation, and stops after unsubscribe', () => {
    const engine = createEngine(linearForm())
    const listener = vi.fn()
    const unsubscribe = engine.subscribe(listener)
    engine.next()
    engine.setAnswer('name', 'Ada')
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    engine.setAnswer('name', 'Grace')
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('never mutates a handed-out snapshot', () => {
    const engine = createEngine(linearForm())
    engine.next()
    const before = engine.getState()
    const answersBefore = before.answers
    engine.setAnswer('name', 'Ada')
    expect(answersBefore).toEqual({})
    expect(before.currentId).toBe(engine.getState().currentId)
  })
})
