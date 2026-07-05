// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import {
  createBlockRegistry,
  getBlockDefinition,
  v1BlockDefinitions,
  validateBlockProperties,
} from './registry'
import { runtimeBlockDefinitions } from './runtime'

const V1_TYPES = [
  'short_text',
  'long_text',
  'multiple_choice',
  'dropdown',
  'yes_no',
  'legal',
  'email',
  'phone',
  'website',
  'number',
  'date',
  'opinion_scale',
  'nps',
  'welcome',
  'statement',
  'thankyou',
  'ai_followup',
]

const SCREENS = ['welcome', 'statement', 'thankyou']

describe('the v1 registry', () => {
  it('registers exactly the 17 v1 block types', () => {
    expect(v1BlockDefinitions.map((d) => d.type).sort()).toEqual([...V1_TYPES].sort())
    expect(createBlockRegistry().size).toBe(17)
  })

  it('screens are non-answerable; every question type is answerable', () => {
    for (const definition of v1BlockDefinitions) {
      const shouldAnswer = !SCREENS.includes(definition.type)
      expect(definition.isAnswerable, definition.type).toBe(shouldAnswer)
      if (shouldAnswer) expect(typeof definition.validate, definition.type).toBe('function')
      else expect(definition.validate, definition.type).toBeUndefined()
    }
  })

  it('carries complete presentation metadata as plain data', () => {
    const iconKeys = new Set<string>()
    for (const definition of v1BlockDefinitions) {
      expect(definition.displayName.length, definition.type).toBeGreaterThan(0)
      expect(definition.description.length, definition.type).toBeGreaterThan(0)
      expect(definition.iconKey.length, definition.type).toBeGreaterThan(0)
      iconKeys.add(definition.iconKey)
    }
    expect(iconKeys.size).toBe(17) // icon keys are unique
  })

  it('files every type under a v1 category', () => {
    const byCategory = new Map<string, string[]>()
    for (const d of v1BlockDefinitions) {
      byCategory.set(d.category, [...(byCategory.get(d.category) ?? []), d.type])
    }
    expect(byCategory.get('text')).toEqual(['short_text', 'long_text'])
    expect(byCategory.get('choice')).toEqual(['multiple_choice', 'dropdown', 'yes_no', 'legal'])
    expect(byCategory.get('contact')).toEqual(['email', 'phone', 'website'])
    expect(byCategory.get('number')).toEqual(['number', 'date'])
    expect(byCategory.get('rating')).toEqual(['opinion_scale', 'nps'])
    expect(byCategory.get('screen')).toEqual(['welcome', 'statement', 'thankyou'])
    expect(byCategory.get('ai')).toEqual(['ai_followup'])
  })

  it('default properties pass their own schema — except ai_followup, which must be authored', () => {
    for (const definition of v1BlockDefinitions) {
      const result = definition.propertySchema.safeParse(definition.defaultProperties)
      if (definition.type === 'ai_followup') {
        expect(result.success).toBe(false) // goal + fallbackQuestion require author input
      } else {
        expect(result.success, `${definition.type} defaults must be schema-valid`).toBe(true)
      }
    }
  })

  it('getBlockDefinition looks up by type', () => {
    expect(getBlockDefinition('email')?.displayName).toBe('Email')
    expect(getBlockDefinition('hologram')).toBeUndefined()
  })
})

describe('validateBlockProperties', () => {
  it('rejects unknown block types', () => {
    expect(validateBlockProperties('hologram', {})).toEqual({
      ok: false,
      issues: ['unknown block type "hologram"'],
    })
  })

  it('fills schema defaults into the parsed properties', () => {
    const result = validateBlockProperties('welcome', {})
    expect(result).toEqual({ ok: true, properties: { buttonText: 'Start' } })

    const statementResult = validateBlockProperties('statement', undefined)
    expect(statementResult).toEqual({ ok: true, properties: { buttonText: 'Continue' } })
  })

  it('rejects unknown property keys (schemas are strict)', () => {
    const result = validateBlockProperties('short_text', { evil: true })
    expect(result.ok).toBe(false)
  })

  it('flattens Zod issues into path-prefixed strings', () => {
    const result = validateBlockProperties('multiple_choice', { choices: [{ id: '', label: '' }] })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.startsWith('choices.0.id'))).toBe(true)
    }
  })
})

describe('property schemas per type', () => {
  const accepts = (type: string, properties: unknown) => {
    const result = validateBlockProperties(type, properties)
    expect(result, `${type} should accept ${JSON.stringify(properties)}`).toMatchObject({
      ok: true,
    })
  }
  const rejects = (type: string, properties: unknown, fragment?: string) => {
    const result = validateBlockProperties(type, properties)
    expect(result.ok, `${type} should reject ${JSON.stringify(properties)}`).toBe(false)
    if (fragment !== undefined && !result.ok) {
      expect(result.issues.join('\n')).toContain(fragment)
    }
  }

  it('text: placeholder and bounded maxLength', () => {
    accepts('short_text', {})
    accepts('long_text', { placeholder: 'Tell us more…', maxLength: 500 })
    rejects('short_text', { maxLength: 0 })
    rejects('long_text', { maxLength: 10_001 })
    rejects('short_text', { maxLength: 2.5 })
  })

  it('multiple choice: needs at least one choice with unique non-empty entries', () => {
    accepts('multiple_choice', {
      choices: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      multiple: true,
    })
    rejects('multiple_choice', { choices: [] })
    rejects('multiple_choice', {
      choices: [
        { id: 'a', label: 'A' },
        { id: 'a', label: 'Again' },
      ],
    })
    rejects('multiple_choice', { choices: [{ id: 'a', label: '' }] })
    const parsed = validateBlockProperties('multiple_choice', {
      choices: [{ id: 'a', label: 'A' }],
    })
    expect(parsed).toMatchObject({ ok: true, properties: { multiple: false } }) // default fills
  })

  it('dropdown: choices plus optional placeholder', () => {
    accepts('dropdown', { choices: [{ id: 'a', label: 'A' }], placeholder: 'Pick one' })
    rejects('dropdown', {})
    rejects('dropdown', { choices: [{ id: 'a', label: 'A' }], multiple: true }) // not a dropdown thing
  })

  it('number: min ≤ max, positive step', () => {
    accepts('number', { min: 0, max: 10, step: 0.5 })
    rejects('number', { min: 10, max: 0 }, 'min must be less than or equal to max')
    rejects('number', { step: 0 })
    rejects('number', { step: -1 })
    rejects('number', { min: Number.NaN })
  })

  it('date: real ISO bounds in order', () => {
    accepts('date', { min: '2026-01-01', max: '2026-12-31' })
    rejects('date', { min: '2026-02-30' }, 'not a real calendar date')
    rejects('date', { min: '01/02/2026' })
    rejects('date', { min: '2026-12-31', max: '2026-01-01' }, 'min must be on or before max')
  })

  it('opinion scale: integers, 0–10 window, min strictly below max', () => {
    accepts('opinion_scale', { min: 1, max: 5 })
    accepts('opinion_scale', { min: 0, max: 10, minLabel: 'Awful', maxLabel: 'Great' })
    rejects('opinion_scale', { min: 5, max: 5 }, 'min must be less than max')
    rejects('opinion_scale', { min: 5, max: 3 })
    rejects('opinion_scale', { max: 11 })
    rejects('opinion_scale', { min: -1, max: 5 })
    const parsed = validateBlockProperties('opinion_scale', {})
    expect(parsed).toMatchObject({ ok: true, properties: { min: 1, max: 5 } }) // defaults fill
  })

  it('nps: fixed 0–10, only labels configurable', () => {
    accepts('nps', { minLabel: 'Not likely', maxLabel: 'Extremely likely' })
    rejects('nps', { min: 1 })
  })

  it('screens: button text defaults; thank-you redirect must be http(s)', () => {
    accepts('welcome', { buttonText: 'Begin' })
    rejects('welcome', { buttonText: '' })
    accepts('thankyou', {})
    accepts('thankyou', { redirectUrl: 'https://formsmith.app/done' })
    rejects('thankyou', { redirectUrl: 'javascript:alert(1)' }, 'http(s)')
    rejects('thankyou', { redirectUrl: 'not a url' })
  })

  it('ai_followup: goal and fallback question are required, follow-ups capped', () => {
    accepts('ai_followup', {
      goal: 'Understand why they chose that rating',
      fallbackQuestion: 'Could you tell us more about your rating?',
    })
    rejects('ai_followup', { goal: '', fallbackQuestion: 'x' })
    rejects('ai_followup', { goal: 'g', fallbackQuestion: '' })
    rejects('ai_followup', { goal: 'g' }) // fallback is not optional
    rejects('ai_followup', { goal: 'g', fallbackQuestion: 'f', maxFollowups: 0 })
    rejects('ai_followup', { goal: 'g', fallbackQuestion: 'f', maxFollowups: 6 })
    rejects('ai_followup', { goal: 'g', fallbackQuestion: 'f', maxFollowups: 1.5 })
    const parsed = validateBlockProperties('ai_followup', { goal: 'g', fallbackQuestion: 'f' })
    expect(parsed).toMatchObject({ ok: true, properties: { maxFollowups: 1 } })
  })
})

describe('the runtime entry (hot-path subset)', () => {
  it('agrees with the full definitions: same types, flags, and validator identity', () => {
    expect(runtimeBlockDefinitions.map((d) => d.type)).toEqual(
      v1BlockDefinitions.map((d) => d.type),
    )
    for (const [index, runtime] of runtimeBlockDefinitions.entries()) {
      const full = v1BlockDefinitions[index]
      expect(runtime.isAnswerable, runtime.type).toBe(full?.isAnswerable)
      expect(runtime.validate, runtime.type).toBe(full?.validate) // same function object
    }
  })
})
