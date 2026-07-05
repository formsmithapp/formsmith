// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine, extractHiddenFields } from './engine'
import { hiddenForm } from './fixtures'

describe('hidden fields / URL prefill', () => {
  it('accepts only declared hidden-field names', () => {
    const engine = createEngine(hiddenForm(), {
      hiddenFields: { visitor: 'Ada', evil: 'payload' },
    })
    expect(engine.getState().hidden).toEqual({ visitor: 'Ada' })
  })

  it('truncates oversize prefill values client-side', () => {
    const engine = createEngine(hiddenForm(), { hiddenFields: { visitor: 'x'.repeat(5000) } })
    expect((engine.getState().hidden.visitor ?? '').length).toBe(1000)
  })

  it('extractHiddenFields picks declared names out of a query string', () => {
    const hidden = extractHiddenFields(
      hiddenForm(),
      '?utm_source=email&visitor=Ada%20Lovelace&irrelevant=1',
    )
    expect(hidden).toEqual({ utm_source: 'email', visitor: 'Ada Lovelace' })
  })

  it('extractHiddenFields output plugs straight into createEngine', () => {
    const engine = createEngine(hiddenForm(), {
      hiddenFields: extractHiddenFields(hiddenForm(), 'utm_source=email&visitor=Ada'),
    })
    expect(engine.pipe('Hi {{visitor}}!')).toBe('Hi Ada!')
    expect(engine.getVisibleBlocks().map((b) => b.ref)).toContain('vip_q')
  })

  it('survives reset()', () => {
    const engine = createEngine(hiddenForm(), { hiddenFields: { visitor: 'Ada' } })
    engine.reset()
    expect(engine.getState().hidden).toEqual({ visitor: 'Ada' })
  })
})
