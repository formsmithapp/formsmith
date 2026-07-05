// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { isValidRef, slugify, uniqueRef } from './slug'

describe('ref slugs', () => {
  it('slugifies titles into dot-free engine-safe refs', () => {
    expect(slugify('What is your name?')).toBe('what_is_your_name')
    expect(slugify('Café & Crème!')).toBe('cafe_creme')
    expect(slugify('2nd choice')).toBe('_2nd_choice')
  })

  it('never emits reserved words or empties', () => {
    expect(slugify('var')).toBe('var_1')
    expect(slugify('hidden')).toBe('hidden_1')
    expect(slugify('!!!')).toBe('field_1')
  })

  it('uniquifies against taken refs', () => {
    const taken = new Set(['email', 'email_2'])
    expect(uniqueRef('email', taken)).toBe('email_3')
    expect(uniqueRef('name', taken)).toBe('name')
  })

  it('validates hand-edited refs', () => {
    const taken = new Set(['name'])
    expect(isValidRef('customer_email', taken)).toBe(true)
    expect(isValidRef('name', taken)).toBe(false)
    expect(isValidRef('has.dot', taken)).toBe(false)
    expect(isValidRef('block', taken)).toBe(false)
  })
})
