// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { hiddenForm, visibilityForm } from './fixtures'

describe('visibility rules', () => {
  it('hides rule-gated blocks until their condition holds', () => {
    const engine = createEngine(visibilityForm())
    expect(engine.getVisibleBlocks().map((b) => b.ref)).toEqual(['have_pet', 'fav_color', 'ending'])

    engine.setAnswer('have_pet', true)
    expect(engine.getVisibleBlocks().map((b) => b.ref)).toEqual([
      'have_pet',
      'pet_name',
      'fav_color',
      'ending',
    ])
  })

  it('navigation skips hidden blocks', () => {
    const engine = createEngine(visibilityForm())
    engine.setAnswer('have_pet', false)
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('fav_color')
  })

  it('navigation enters blocks revealed by an answer', () => {
    const engine = createEngine(visibilityForm())
    engine.setAnswer('have_pet', true)
    engine.next()
    expect(engine.getCurrentBlock()?.ref).toBe('pet_name')
  })

  it('progress tracks the visible set', () => {
    const engine = createEngine(visibilityForm())
    expect(engine.progress().total).toBe(2)
    engine.setAnswer('have_pet', true)
    expect(engine.progress().total).toBe(3)
  })

  it('goTo() refuses a hidden block in runtime mode but allows it in edit mode', () => {
    const runtime = createEngine(visibilityForm())
    const blocked = runtime.goTo('pet_name')
    expect(blocked.ok).toBe(false)
    expect(runtime.getCurrentBlock()?.ref).toBe('have_pet')

    const edit = createEngine(visibilityForm(), { mode: 'edit' })
    expect(edit.goTo('pet_name').ok).toBe(true)
    expect(edit.getCurrentBlock()?.ref).toBe('pet_name')
  })

  it('hidden-field values can drive visibility', () => {
    const plain = createEngine(hiddenForm())
    expect(plain.getVisibleBlocks().map((b) => b.ref)).not.toContain('vip_q')

    const fromEmail = createEngine(hiddenForm(), { hiddenFields: { utm_source: 'email' } })
    expect(fromEmail.getVisibleBlocks().map((b) => b.ref)).toContain('vip_q')
  })
})
