// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { getBlockDefinition } from './registry'
import type { BlockLike } from './types'

/**
 * Intrinsic answer validation per type. The engine calls these with
 * non-empty values only (required/empty and the custom-message constraint
 * layer are the engine's orchestration, covered by the engine's own suite).
 */
const check = (
  type: string,
  value: unknown,
  properties?: Record<string, unknown>,
  required = false,
): string[] => {
  const definition = getBlockDefinition(type)
  if (definition?.validate === undefined) throw new Error(`no validator for ${type}`)
  const block: BlockLike = { type, required, properties }
  return definition.validate(value, block)
}

describe('text answers', () => {
  it('accepts strings, rejects everything else', () => {
    expect(check('short_text', 'hello')).toEqual([])
    expect(check('long_text', 'hello\nworld')).toEqual([])
    expect(check('ai_followup', 'because I said so')).toEqual([])
    expect(check('short_text', 42)).toEqual(['Please enter text.'])
    expect(check('long_text', ['a'])).toEqual(['Please enter text.'])
  })

  it('enforces the configured maxLength', () => {
    expect(check('short_text', 'abcdef', { maxLength: 5 })).toEqual([
      'Please enter at most 5 characters.',
    ])
    expect(check('short_text', 'abcde', { maxLength: 5 })).toEqual([])
    expect(check('long_text', 'x'.repeat(21), { maxLength: 20 })).toEqual([
      'Please enter at most 20 characters.',
    ])
  })
})

describe('choice answers', () => {
  const choices = {
    choices: [
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ],
  }

  it('multiple_choice single mode wants one known id', () => {
    expect(check('multiple_choice', 'a', choices)).toEqual([])
    expect(check('multiple_choice', 'z', choices)).toEqual(['Please select a valid choice.'])
    expect(check('multiple_choice', ['a'], choices)).toEqual(['Please select a valid choice.'])
  })

  it('multiple_choice multi mode wants distinct known ids', () => {
    const multi = { ...choices, multiple: true }
    expect(check('multiple_choice', ['a', 'b'], multi)).toEqual([])
    expect(check('multiple_choice', ['a', 'z'], multi)).toEqual([
      'Please select from the available choices.',
    ])
    expect(check('multiple_choice', ['a', 'a'], multi)).toEqual([
      'Please select from the available choices.',
    ])
    expect(check('multiple_choice', 'a', multi)).toEqual([
      'Please select from the available choices.',
    ])
  })

  it('dropdown wants one known id', () => {
    expect(check('dropdown', 'b', choices)).toEqual([])
    expect(check('dropdown', 'z', choices)).toEqual(['Please select a valid choice.'])
  })

  it('yes_no wants a boolean — both answers are valid', () => {
    expect(check('yes_no', true)).toEqual([])
    expect(check('yes_no', false)).toEqual([])
    expect(check('yes_no', 'yes')).toEqual(['Please select yes or no.'])
  })

  it('legal consent must be accepted when required', () => {
    expect(check('legal', true, undefined, true)).toEqual([])
    expect(check('legal', false, undefined, true)).toEqual(['Please accept to continue.'])
    expect(check('legal', false, undefined, false)).toEqual([]) // declining an optional consent is fine
    expect(check('legal', 'yes')).toEqual(['Please choose whether you accept.'])
  })
})

describe('contact answers', () => {
  it('email format', () => {
    expect(check('email', 'ada@lovelace.dev')).toEqual([])
    expect(check('email', 'nope')).toEqual(['Please enter a valid email address.'])
    expect(check('email', 'a b@c.dev')).not.toEqual([])
  })

  it('phone basic validation', () => {
    expect(check('phone', '+44 (0) 20 7946-0958')).toEqual([])
    expect(check('phone', '12')).toEqual(['Please enter a valid phone number.'])
    expect(check('phone', 'call me')).not.toEqual([])
  })

  it('website requires an http(s) URL', () => {
    expect(check('website', 'https://formsmith.app')).toEqual([])
    expect(check('website', 'javascript:alert(1)')).not.toEqual([])
    expect(check('website', 'formsmith.app')).not.toEqual([])
  })
})

describe('number and date answers', () => {
  it('number wants a finite number', () => {
    expect(check('number', 42)).toEqual([])
    expect(check('number', -0.5)).toEqual([])
    expect(check('number', '42')).toEqual(['Please enter a number.'])
    expect(check('number', Number.POSITIVE_INFINITY)).toEqual(['Please enter a number.'])
  })

  it('number honors configured min/max', () => {
    expect(check('number', 17, { min: 18 })).toEqual(['Value must be at least 18.'])
    expect(check('number', 18, { min: 18 })).toEqual([])
    expect(check('number', 121, { max: 120 })).toEqual(['Value must be at most 120.'])
  })

  it('number honors step, anchored at min, without float noise', () => {
    expect(check('number', 0.3, { step: 0.1 })).toEqual([]) // 0.3/0.1 is 2.9999… in floats
    expect(check('number', 0.35, { step: 0.1 })).toEqual(['Please use increments of 0.1.'])
    expect(check('number', 25, { min: 10, step: 5 })).toEqual([])
    expect(check('number', 27, { min: 10, step: 5 })).toEqual(['Please use increments of 5.'])
  })

  it('date wants a real ISO date', () => {
    expect(check('date', '1990-02-28')).toEqual([])
    expect(check('date', '1990-02-30')).toEqual(['Please enter a valid date (YYYY-MM-DD).'])
    expect(check('date', '28/02/1990')).not.toEqual([])
  })

  it('date honors configured bounds', () => {
    const bounds = { min: '2026-01-01', max: '2026-12-31' }
    expect(check('date', '2026-06-15', bounds)).toEqual([])
    expect(check('date', '2025-12-31', bounds)).toEqual([
      'Please pick a date on or after 2026-01-01.',
    ])
    expect(check('date', '2027-01-01', bounds)).toEqual([
      'Please pick a date on or before 2026-12-31.',
    ])
  })
})

describe('rating answers', () => {
  it('opinion scale stays within its configured range', () => {
    expect(check('opinion_scale', 3)).toEqual([]) // default 1–5
    expect(check('opinion_scale', 6)).toEqual(['Please select a value between 1 and 5.'])
    expect(check('opinion_scale', 0, { min: 0, max: 10 })).toEqual([])
    expect(check('opinion_scale', 11, { min: 0, max: 10 })).toEqual([
      'Please select a value between 0 and 10.',
    ])
    expect(check('opinion_scale', 2.5)).not.toEqual([])
  })

  it('NPS is a 0–10 integer, not configurable', () => {
    expect(check('nps', 0)).toEqual([])
    expect(check('nps', 10)).toEqual([])
    expect(check('nps', -1)).toEqual(['Please select a value between 0 and 10.'])
    expect(check('nps', 11)).not.toEqual([])
    expect(check('nps', 7.5)).not.toEqual([])
  })
})
