// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import * as engine from './index'

// The public surface promised to every consumer (renderer, server, embed).
describe('@formsmithapp/engine public API', () => {
  it('exports the engine factory and server evaluation', () => {
    expect(typeof engine.createEngine).toBe('function')
    expect(typeof engine.evaluateSubmission).toBe('function')
    expect(typeof engine.extractHiddenFields).toBe('function')
    expect(typeof engine.createDefaultRegistry).toBe('function')
    expect(typeof engine.pipeText).toBe('function')
    expect(typeof engine.escapeHtml).toBe('function')
    expect(typeof engine.validateBlockValue).toBe('function')
    expect(engine.DEFAULT_SUBMISSION_LIMITS.maxStringLength).toBeGreaterThan(0)
  })

  it('exposes the architecture instance surface', () => {
    const instance = engine.createEngine({
      id: 'f',
      blocks: [{ id: 'b1', ref: 'q1', type: 'short_text', title: 'Q1' }],
    })
    for (const method of [
      'getCurrentBlock',
      'next',
      'prev',
      'goTo',
      'setAnswer',
      'getVisibleBlocks',
      'validate',
      'validateAll',
      'computeVariables',
      'pipe',
      'progress',
      'serialize',
      'hydrate',
      'on',
      'getState',
      'subscribe',
      'reset',
    ] as const) {
      expect(typeof instance[method], method).toBe('function')
    }
  })
})
