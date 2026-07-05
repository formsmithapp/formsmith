// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'

import {
  collectRuleRefs,
  DEFAULT_ALLOWED_OPERATORS,
  DEFAULT_LIMITS,
  type RuleValidationOptions,
  validateRuleAst,
} from './validate'

const KNOWN_REFS = ['have_pet', 'score', 'tags', 'address', 'name', 'age', 'x'] as const

const options: RuleValidationOptions = { knownRefs: KNOWN_REFS }

const expectOk = (expr: unknown, opts: RuleValidationOptions = options) => {
  expect(validateRuleAst(expr, opts)).toEqual({ ok: true })
}

const expectIssues = (
  expr: unknown,
  substrings: string[],
  opts: RuleValidationOptions = options,
): string[] => {
  const result = validateRuleAst(expr, opts)
  expect(result.ok).toBe(false)
  if (result.ok) throw new Error('unreachable')
  for (const substring of substrings) {
    expect(result.issues.join('\n')).toContain(substring)
  }
  return result.issues
}

describe('defaults', () => {
  it('exposes the documented default limits', () => {
    expect(DEFAULT_LIMITS).toEqual({ maxDepth: 12, maxNodes: 256 })
  })

  it('exposes the exact default operator allowlist', () => {
    expect([...DEFAULT_ALLOWED_OPERATORS]).toEqual([
      'var',
      'missing',
      'missing_some',
      'if',
      '==',
      '===',
      '!=',
      '!==',
      '!',
      '!!',
      'or',
      'and',
      '>',
      '>=',
      '<',
      '<=',
      '+',
      '-',
      '*',
      '/',
      '%',
      'min',
      'max',
      'in',
      'cat',
      'substr',
    ])
  })

  it('excludes iteration and engine-extension operators from the default allowlist', () => {
    const excluded = [
      'map',
      'filter',
      'reduce',
      'all',
      'some',
      'none',
      'merge',
      'val',
      'exists',
      'throw',
      'try',
      'pipe',
      'eachKey',
      'keys',
      'length',
      '??',
      'preserve',
      'log',
      'method',
    ]
    for (const op of excluded) {
      expect(DEFAULT_ALLOWED_OPERATORS).not.toContain(op)
      expectIssues({ [op]: [1, 2] }, [`"${op}"`])
    }
  })
})

describe('validateRuleAst — accepts', () => {
  it('accepts a typical visibility rule', () => {
    expectOk({ '==': [{ var: 'have_pet' }, true] })
  })

  it('accepts a jump condition with and/or', () => {
    expectOk({
      and: [
        { '>': [{ var: 'age' }, 18] },
        { or: [{ '==': [{ var: 'have_pet' }, true] }, { '!': [{ var: 'name' }] }] },
      ],
    })
  })

  it('accepts a scoring expression', () => {
    expectOk({ '+': [{ var: 'score' }, 10] })
  })

  it('accepts if with 3 branches', () => {
    expectOk({ if: [{ '>': [{ var: 'score' }, 10] }, 'high', 'low'] })
  })

  it('accepts in with an array haystack and with a substring haystack', () => {
    expectOk({ in: ['a', { var: 'tags' }] })
    expectOk({ in: ['ell', { var: 'name' }] })
  })

  it('accepts cat and substr', () => {
    expectOk({ cat: ['Hello, ', { var: 'name' }] })
    expectOk({ substr: [{ var: 'name' }, 0, 3] })
  })

  it('accepts missing and missing_some with known refs', () => {
    expectOk({ missing: ['name', 'age'] })
    expectOk({ missing: 'name' })
    expectOk({ missing_some: [1, ['name', 'age']] })
  })

  it('accepts the var default form', () => {
    expectOk({ var: ['x', 5] })
    expectOk({ var: ['x'] })
  })

  it('accepts a rule node as the var default', () => {
    expectOk({ var: ['x', { '+': [{ var: 'score' }, 1] }] })
  })

  it('accepts a nested dot-path with a known first segment', () => {
    expectOk({ var: 'address.city' })
    expectOk({ var: 'address.geo.lat' })
  })

  it('accepts primitive literals as whole rules', () => {
    expectOk(true)
    expectOk(false)
    expectOk(42)
    expectOk('hello')
    expectOk(null)
  })

  it('accepts arrays of rule nodes', () => {
    expectOk([1, { var: 'x' }, 'y', null])
  })
})

describe('validateRuleAst — rejects', () => {
  it('rejects unknown operators and reports the name', () => {
    expectIssues({ map: [{ var: 'tags' }, 1] }, ['"map"'])
    expectIssues({ evil: [1] }, ['"evil"'])
  })

  it('rejects an object with two keys', () => {
    expectIssues({ '==': [1, 1], '!=': [1, 2] }, ['exactly one operator key'])
  })

  it('rejects an empty object', () => {
    expectIssues({}, ['exactly one operator key'])
  })

  it('rejects var with an empty-string path (whole-context access)', () => {
    expectIssues({ var: '' }, ['non-empty string'])
    expectIssues({ var: [''] }, ['non-empty string'])
  })

  it('rejects var with a numeric argument', () => {
    expectIssues({ var: 1 }, ['"var" path must be a non-empty string'])
    expectIssues({ var: [0, 'default'] }, ['"var" path must be a non-empty string'])
  })

  it('rejects var argument arrays with the wrong arity', () => {
    expectIssues({ var: [] }, ['[path] or [path, default]'])
    expectIssues({ var: ['x', 1, 2] }, ['[path] or [path, default]'])
  })

  it('rejects unknown refs, reporting the first dot-segment', () => {
    expectIssues({ var: 'nope' }, ['unknown ref: nope'])
    expectIssues({ var: 'pet.name' }, ['unknown ref: pet'])
    expectIssues({ var: ['nope', 5] }, ['unknown ref: nope'])
  })

  it('rejects unknown refs in missing and missing_some', () => {
    expectIssues({ missing: ['nope'] }, ['unknown ref: nope'])
    expectIssues({ missing: 'nope' }, ['unknown ref: nope'])
    expectIssues({ missing_some: [1, ['name', 'nope']] }, ['unknown ref: nope'])
  })

  it('rejects dynamic arguments to missing', () => {
    expectIssues({ missing: { var: 'name' } }, ['literal strings'])
    expectIssues({ missing: ['name', { var: 'x' }] }, ['literal strings'])
    expectIssues({ missing: [1] }, ['literal strings'])
  })

  it('rejects malformed missing_some arguments', () => {
    expectIssues({ missing_some: 'name' }, ['[count, [refs...]]'])
    expectIssues({ missing_some: [1] }, ['[count, [refs...]]'])
    expectIssues({ missing_some: ['1', ['name']] }, ['count must be a literal number'])
    expectIssues({ missing_some: [1, 'name'] }, ['array of literal strings'])
    expectIssues({ missing_some: [1, [{ var: 'name' }]] }, ['literal strings'])
  })

  it('rejects a ~50-level depth bomb quickly with a single depth issue', () => {
    let bomb: unknown = { var: 'x' }
    for (let i = 0; i < 50; i += 1) {
      bomb = { '!': bomb }
    }
    const issues = expectIssues(bomb, ['maximum depth of 12'])
    expect(issues.filter((issue) => issue.includes('maximum depth')).length).toBe(1)
  })

  it('does not stack-overflow on a very deep bomb', () => {
    // Recursion stops at the depth cap, so even 100k levels must be safe.
    let bomb: unknown = true
    for (let i = 0; i < 100_000; i += 1) {
      bomb = { '!': bomb }
    }
    expectIssues(bomb, ['maximum depth of 12'])
  })

  it('rejects a node-count bomb with a single node-count issue and stops early', () => {
    const wide = { cat: Array.from({ length: 300 }, (_, i) => String(i)) }
    const issues = expectIssues(wide, ['maximum node count of 256'])
    expect(issues.filter((issue) => issue.includes('maximum node count')).length).toBe(1)
  })

  it('rejects non-plain objects', () => {
    expectIssues(new Date(), ['non-plain'])
    expectIssues(new Map(), ['non-plain'])
    class Sneaky {
      var = 'x'
    }
    expectIssues(new Sneaky(), ['non-plain'])
  })

  it('rejects undefined, functions, symbols, and bigints', () => {
    expectIssues(undefined, ['undefined'])
    expectIssues(() => true, ['function'])
    expectIssues(Symbol('s'), ['symbol'])
    expectIssues(10n, ['bigint'])
    expectIssues({ '==': [{ var: 'x' }, undefined] }, ['undefined'])
  })

  it('collects multiple issues in one pass', () => {
    const issues = expectIssues({ and: [{ var: 'nope1' }, { var: 'nope2' }] }, [
      'unknown ref: nope1',
      'unknown ref: nope2',
    ])
    expect(issues.length).toBe(2)
  })

  it('collects issues of different kinds together', () => {
    const issues = expectIssues({ or: [{ evil: [1] }, { var: '' }, { missing: [2] }] }, [
      '"evil"',
      'non-empty string',
      'literal strings',
    ])
    expect(issues.length).toBe(3)
  })
})

describe('validateRuleAst — custom limits and allowlists', () => {
  it('honors a custom maxDepth', () => {
    const limited: RuleValidationOptions = { knownRefs: KNOWN_REFS, limits: { maxDepth: 2 } }
    // {'!': true} is depth 2 (object → leaf); {'!': {'!': true}} reaches depth 3.
    expectOk({ '!': true }, limited)
    expectIssues({ '!': { '!': true } }, ['maximum depth of 2'], limited)
  })

  it('honors a custom maxNodes', () => {
    const limited: RuleValidationOptions = { knownRefs: KNOWN_REFS, limits: { maxNodes: 3 } }
    // object + argument array + one element = 3 nodes.
    expectOk({ '!': [true] }, limited)
    expectIssues({ '+': [1, 2, 3] }, ['maximum node count of 3'], limited)
  })

  it('honors a custom operator allowlist', () => {
    const narrow: RuleValidationOptions = {
      knownRefs: KNOWN_REFS,
      allowedOperators: ['var', '=='],
    }
    expectOk({ '==': [{ var: 'x' }, 1] }, narrow)
    expectIssues({ cat: ['a', 'b'] }, ['"cat"'], narrow)
    expectIssues({ and: [true] }, ['"and"'], narrow)
  })

  it('allows operators outside the default list when explicitly allowlisted', () => {
    const withMerge: RuleValidationOptions = {
      knownRefs: KNOWN_REFS,
      allowedOperators: ['merge', 'var'],
    }
    expectOk({ merge: [[1], [{ var: 'x' }]] }, withMerge)
  })

  it('accepts knownRefs as any iterable', () => {
    expectOk({ var: 'a' }, { knownRefs: new Set(['a']) })
    expectIssues({ var: 'b' }, ['unknown ref: b'], { knownRefs: new Set(['a']) })
  })
})

describe('collectRuleRefs', () => {
  it('collects first segments of var paths, including dot paths and defaults', () => {
    const refs = collectRuleRefs({
      and: [
        { '==': [{ var: 'address.city' }, 'Oslo'] },
        { '>': [{ var: ['age', { var: 'score' }] }, 18] },
      ],
    })
    expect([...refs].sort()).toEqual(['address', 'age', 'score'])
  })

  it('collects refs from missing and missing_some', () => {
    expect([...collectRuleRefs({ missing: ['name', 'age'] })].sort()).toEqual(['age', 'name'])
    expect([...collectRuleRefs({ missing_some: [1, ['x', 'score']] })].sort()).toEqual([
      'score',
      'x',
    ])
  })

  it('returns nothing for literal-only rules and tolerates junk shapes', () => {
    expect(collectRuleRefs(true).size).toBe(0)
    expect(collectRuleRefs({ '==': [1, 2] }).size).toBe(0)
    expect(collectRuleRefs({ two: 1, keys: 2 }).size).toBe(0)
    expect(collectRuleRefs(undefined).size).toBe(0)
  })
})
