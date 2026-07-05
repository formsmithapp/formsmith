// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'

import { compileRule, evaluateRule, RuleValidationError } from './evaluate'
import type { RuleValidationOptions } from './validate'

const options: RuleValidationOptions = {
  knownRefs: ['have_pet', 'score', 'tags', 'address', 'name', 'age', 'a', 'b', 'x'],
}

describe('compileRule', () => {
  it('compiles a valid rule to a reusable function', () => {
    const rule = compileRule({ '>': [{ var: 'score' }, 10] }, options)
    expect(typeof rule).toBe('function')
    expect(rule({ score: 20 })).toBe(true)
    expect(rule({ score: 5 })).toBe(false)
    expect(rule({})).toBe(false)
  })

  it('throws RuleValidationError for an invalid rule, carrying the issues', () => {
    expect(() => compileRule({ evil: [1] }, options)).toThrowError(RuleValidationError)
    try {
      compileRule({ and: [{ var: 'nope' }, { evil: [1] }] }, options)
      expect.unreachable('compileRule must throw for an invalid rule')
    } catch (error) {
      expect(error).toBeInstanceOf(RuleValidationError)
      const validationError = error as RuleValidationError
      expect(validationError.issues.length).toBe(2)
      expect(validationError.issues.join('\n')).toContain('unknown ref: nope')
      expect(validationError.issues.join('\n')).toContain('"evil"')
      expect(validationError.message).toContain('unknown ref: nope')
    }
  })

  it('throws RuleValidationError for a depth bomb instead of overflowing', () => {
    let bomb: unknown = true
    for (let i = 0; i < 50; i += 1) {
      bomb = { '!': bomb }
    }
    expect(() => compileRule(bomb, options)).toThrowError(RuleValidationError)
  })
})

describe('evaluateRule — end-to-end semantics', () => {
  it('evaluates comparisons', () => {
    expect(evaluateRule({ '==': [{ var: 'a' }, 1] }, { a: 1 }, options)).toBe(true)
    expect(evaluateRule({ '==': [{ var: 'a' }, '1'] }, { a: 1 }, options)).toBe(true)
    expect(evaluateRule({ '===': [{ var: 'a' }, '1'] }, { a: 1 }, options)).toBe(false)
    expect(evaluateRule({ '!=': [{ var: 'a' }, 2] }, { a: 1 }, options)).toBe(true)
    expect(evaluateRule({ '<': [{ var: 'age' }, 30] }, { age: 18 }, options)).toBe(true)
    expect(evaluateRule({ '>=': [{ var: 'age' }, 18] }, { age: 18 }, options)).toBe(true)
  })

  it('returns and/or short-circuit values, not booleans', () => {
    expect(evaluateRule({ and: [true, 'yes'] }, {}, options)).toBe('yes')
    expect(evaluateRule({ and: [0, 'never'] }, {}, options)).toBe(0)
    expect(evaluateRule({ or: [false, 0, 'x'] }, {}, options)).toBe('x')
    expect(evaluateRule({ or: [false, 0] }, {}, options)).toBe(0)
  })

  it('evaluates if/else branches', () => {
    const rule = { if: [{ '>': [{ var: 'score' }, 10] }, 'high', 'low'] }
    expect(evaluateRule(rule, { score: 20 }, options)).toBe('high')
    expect(evaluateRule(rule, { score: 3 }, options)).toBe('low')
  })

  it('evaluates arithmetic', () => {
    expect(evaluateRule({ '+': [{ var: 'score' }, 10] }, { score: 5 }, options)).toBe(15)
    expect(evaluateRule({ '-': [{ var: 'score' }, 2] }, { score: 5 }, options)).toBe(3)
    expect(evaluateRule({ '*': [{ var: 'score' }, 3] }, { score: 5 }, options)).toBe(15)
    expect(evaluateRule({ '/': [{ var: 'score' }, 2] }, { score: 10 }, options)).toBe(5)
    expect(evaluateRule({ '%': [7, 3] }, {}, options)).toBe(1)
    expect(evaluateRule({ min: [3, { var: 'score' }, 2] }, { score: 1 }, options)).toBe(1)
    expect(evaluateRule({ max: [3, { var: 'score' }, 2] }, { score: 9 }, options)).toBe(9)
  })

  it('evaluates cat concatenation and substr', () => {
    expect(evaluateRule({ cat: ['Hello, ', { var: 'name' }] }, { name: 'Ada' }, options)).toBe(
      'Hello, Ada',
    )
    expect(evaluateRule({ substr: [{ var: 'name' }, 0, 3] }, { name: 'formsmith' }, options)).toBe(
      'for',
    )
  })

  it('evaluates in for arrays and substrings', () => {
    expect(evaluateRule({ in: ['a', { var: 'tags' }] }, { tags: ['a', 'b'] }, options)).toBe(true)
    expect(evaluateRule({ in: ['z', { var: 'tags' }] }, { tags: ['a', 'b'] }, options)).toBe(false)
    expect(evaluateRule({ in: ['ell', { var: 'name' }] }, { name: 'hello' }, options)).toBe(true)
  })

  it('resolves var with dot-paths, defaults, and missing keys', () => {
    expect(evaluateRule({ var: 'address.city' }, { address: { city: 'Berlin' } }, options)).toBe(
      'Berlin',
    )
    expect(evaluateRule({ var: ['x', 5] }, {}, options)).toBe(5)
    expect(evaluateRule({ var: ['x', 5] }, { x: 7 }, options)).toBe(7)
    expect(evaluateRule({ var: 'x' }, {}, options)).toBe(null)
  })

  it('evaluates missing and missing_some', () => {
    expect(evaluateRule({ missing: ['name', 'age'] }, { name: 'Ada' }, options)).toEqual(['age'])
    expect(evaluateRule({ missing: ['name', 'age'] }, { name: 'a', age: 1 }, options)).toEqual([])
    expect(
      evaluateRule({ missing_some: [2, ['name', 'age', 'x']] }, { name: 'Ada' }, options),
    ).toEqual(['age', 'x'])
    expect(evaluateRule({ missing_some: [1, ['name', 'age']] }, { name: 'Ada' }, options)).toEqual(
      [],
    )
  })

  it('throws RuleValidationError for an invalid rule', () => {
    expect(() => evaluateRule({ var: 'nope' }, {}, options)).toThrowError(RuleValidationError)
  })
})

describe('fail-closed evaluation', () => {
  // Empirical json-logic-engine v5.0.7 behavior (verified against the real
  // engine): numeric operators throw on NaN results — division by zero throws
  // the *primitive* NaN (not an Error), '+' on a non-numeric operand throws
  // NaN, and 'substr' on a non-string throws a TypeError. Our wrappers must
  // catch all of these (including non-Error throws) and return null.

  it('returns null when division by zero throws at runtime', () => {
    expect(evaluateRule({ '/': [{ var: 'a' }, { var: 'b' }] }, { a: 1, b: 0 }, options)).toBe(null)
    const rule = compileRule({ '/': [{ var: 'a' }, { var: 'b' }] }, options)
    expect(rule({ a: 1, b: 0 })).toBe(null)
    // The same compiled rule still works for well-formed data.
    expect(rule({ a: 10, b: 2 })).toBe(5)
  })

  it('returns null when arithmetic on non-numeric data throws', () => {
    expect(evaluateRule({ '+': [{ var: 'a' }, 10] }, { a: 'abc' }, options)).toBe(null)
    expect(evaluateRule({ '>': [{ var: 'a' }, 1] }, { a: 'abc' }, options)).toBe(null)
    const rule = compileRule({ '*': [{ var: 'a' }, 2] }, options)
    expect(rule({ a: { nested: true } })).toBe(null)
    expect(rule({ a: 4 })).toBe(8)
  })

  it('returns null when substr is applied to a non-string', () => {
    expect(evaluateRule({ substr: [{ var: 'a' }, 0, 2] }, { a: 5 }, options)).toBe(null)
  })

  it('fails closed when a literal-only rule throws at build time', () => {
    // json-logic-engine constant-folds literal subtrees inside build(), so
    // {'/': [1, 0]} throws NaN during compilation rather than at call time.
    // compileRule converts that into a rule that always returns null.
    const rule = compileRule({ '/': [1, 0] }, options)
    expect(rule({})).toBe(null)
    expect(evaluateRule({ '/': [1, 0] }, {}, options)).toBe(null)
  })
})
