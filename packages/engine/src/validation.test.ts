// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { validationForm } from './fixtures'

const engineFor = () => createEngine(validationForm())

const validity = (ref: string, value: unknown): string[] => {
  const engine = engineFor()
  engine.setAnswer(ref, value)
  return engine.validate(ref)
}

describe('per-type validation', () => {
  it('short_text / long_text / ai_followup accept strings only', () => {
    expect(validity('username', 'ada')).toEqual([])
    expect(validity('username', 42)).toEqual(['Please enter text.'])
    expect(validity('bio', 'hello')).toEqual([])
    expect(validity('followup', 'because')).toEqual([])
  })

  it('email', () => {
    expect(validity('contact_email', 'ada@lovelace.dev')).toEqual([])
    expect(validity('contact_email', 'nope')).toEqual(['Please enter a valid email address.'])
    expect(validity('contact_email', 'a b@c.dev')).not.toEqual([])
  })

  it('phone', () => {
    expect(validity('contact_phone', '+44 (0) 20 7946-0958')).toEqual([])
    expect(validity('contact_phone', '12')).toEqual(['Please enter a valid phone number.'])
    expect(validity('contact_phone', 'call me')).not.toEqual([])
  })

  it('website requires an http(s) URL', () => {
    expect(validity('site', 'https://formsmith.app')).toEqual([])
    expect(validity('site', 'http://localhost:3000/x?y=1')).toEqual([])
    expect(validity('site', 'formsmith.app')).not.toEqual([])
    expect(validity('site', 'javascript:alert(1)')).not.toEqual([])
  })

  it('number requires a finite number', () => {
    expect(validity('age', 30)).toEqual([])
    expect(validity('age', '30')).toEqual(['Please enter a number.'])
    expect(validity('age', Number.POSITIVE_INFINITY)).toEqual(['Please enter a number.'])
  })

  it('date requires a real ISO calendar date', () => {
    expect(validity('birthday', '1990-02-28')).toEqual([])
    expect(validity('birthday', '1990-02-30')).not.toEqual([])
    expect(validity('birthday', '28/02/1990')).not.toEqual([])
  })

  it('opinion_scale respects its configured range', () => {
    expect(validity('satisfaction', 0)).toEqual([])
    expect(validity('satisfaction', 10)).toEqual([])
    expect(validity('satisfaction', 11)).toEqual(['Please select a value between 0 and 10.'])
    expect(validity('satisfaction', 4.5)).not.toEqual([])
  })

  it('nps is an integer from 0 to 10', () => {
    expect(validity('recommend', 9)).toEqual([])
    expect(validity('recommend', -1)).not.toEqual([])
  })

  it('multiple_choice (multiple) wants known, distinct choice ids', () => {
    expect(validity('pets', ['dog', 'cat'])).toEqual([])
    expect(validity('pets', ['dog', 'dragon'])).toEqual([
      'Please select from the available choices.',
    ])
    expect(validity('pets', ['dog', 'dog'])).not.toEqual([])
    expect(validity('pets', 'dog')).not.toEqual([]) // single value for a multi block
  })

  it('dropdown wants one known choice id', () => {
    expect(validity('plan_choice', 'a')).toEqual([])
    expect(validity('plan_choice', 'z')).toEqual(['Please select a valid choice.'])
  })

  it('yes_no wants a boolean', () => {
    expect(validity('confirm', true)).toEqual([])
    expect(validity('confirm', false)).toEqual([]) // "no" is a real answer
    expect(validity('confirm', 'yes')).not.toEqual([])
  })

  it('required legal consent must be accepted', () => {
    expect(validity('agree', true)).toEqual([])
    expect(validity('agree', false)).toEqual(['Please accept to continue.'])
  })
})

describe('constraint validations and custom messages', () => {
  it('minLength / maxLength / pattern on strings, with custom messages', () => {
    expect(validity('username', 'ab')).toEqual(['Name too short!'])
    expect(validity('username', 'abcdefghijk')).toEqual(['Please enter at most 10 characters.'])
    expect(validity('username', 'Ada')).toEqual(['Lowercase letters only.'])
    expect(validity('bio', 'x'.repeat(21))).toEqual(['Please enter at most 20 characters.'])
  })

  it('min / max on numbers, with custom messages', () => {
    expect(validity('age', 12)).toEqual(['Adults only.'])
    expect(validity('age', 200)).toEqual(['Value must be at most 120.'])
  })

  it('maxLength applies to multi-choice selections', () => {
    expect(validity('pets', ['dog', 'cat', 'fish'])).toEqual(['Pick at most two.'])
  })

  it('a custom required message wins', () => {
    const engine = engineFor()
    expect(engine.validate('contact_email')).toEqual(['We need your email!'])
  })

  it('empty optional blocks are valid; empty required blocks are not', () => {
    const engine = engineFor()
    expect(engine.validate('bio')).toEqual([])
    expect(engine.validate('username')).toEqual(['This field is required.'])
  })
})

describe('validateAll', () => {
  it('collects errors for every visible answerable block', () => {
    const engine = engineFor()
    const result = engine.validateAll()
    expect(result.ok).toBe(false)
    expect(Object.keys(result.errors).sort()).toEqual([
      'agree',
      'confirm',
      'contact_email',
      'username',
    ])
  })

  it('passes once everything required is answered validly', () => {
    const engine = engineFor()
    engine.setAnswer('username', 'ada')
    engine.setAnswer('contact_email', 'ada@lovelace.dev')
    engine.setAnswer('agree', true)
    engine.setAnswer('confirm', false)
    expect(engine.validateAll()).toEqual({ ok: true, errors: {} })
  })
})
