// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { compileCondition, compileGroup } from './compile'
import { decompileGroup } from './decompile'
import type { Condition, ConditionGroup } from './model'
import { summarizeGroup } from './summarize'

const group = (...conditions: Condition[]): ConditionGroup => ({
  combinator: 'and',
  conditions,
})

describe('compile → decompile round-trips (the canonical contract)', () => {
  const matrix: Condition[] = [
    { ref: 'plan', op: 'is', value: 'pro' },
    { ref: 'plan', op: 'is_not', value: 'basic' },
    { ref: 'confirm', op: 'is', value: true },
    { ref: 'terms', op: 'is', value: false },
    { ref: 'pets', op: 'includes', value: 'dog' },
    { ref: 'pets', op: 'not_includes', value: 'cat' },
    { ref: 'bio', op: 'includes', value: 'engineer' }, // text "contains" = same canon
    { ref: 'age', op: 'gt', value: 17 },
    { ref: 'age', op: 'gte', value: 18 },
    { ref: 'score', op: 'lt', value: 20 },
    { ref: 'score', op: 'lte', value: 19 },
    { ref: 'birthday', op: 'gt', value: '2026-01-01' }, // date "after" — ISO compares
    { ref: 'email', op: 'answered' },
    { ref: 'email', op: 'not_answered' },
    { ref: 'utm_source', op: 'is', value: 'email' }, // hidden field
  ]

  for (const condition of matrix) {
    it(`${condition.ref} ${condition.op} ${String(condition.value ?? '')}`, () => {
      expect(decompileGroup(compileGroup(group(condition)))).toEqual(group(condition))
    })
  }

  it('empty group = "always" = literal true, both ways', () => {
    expect(compileGroup({ combinator: 'and', conditions: [] })).toBe(true)
    expect(decompileGroup(true)).toEqual({ combinator: 'and', conditions: [] })
  })

  it('round-trips multi-condition or-groups', () => {
    const g: ConditionGroup = {
      combinator: 'or',
      conditions: [
        { ref: 'plan', op: 'is', value: 'pro' },
        { ref: 'score', op: 'gte', value: 20 },
      ],
    }
    expect(decompileGroup(compileGroup(g))).toEqual(g)
  })

  it('"answered" uses null-compare, not truthiness (0 and false are answers)', () => {
    expect(compileCondition({ ref: 'nps', op: 'answered' })).toEqual({
      '!=': [{ var: 'nps' }, null],
    })
  })
})

describe('decompile strictness — foreign rules become Advanced, never guessed', () => {
  const foreign: unknown[] = [
    { '==': [{ var: 'a' }, { var: 'b' }] }, // computed operand
    { and: [{ '==': [{ var: 'a' }, 1] }, { or: [{ '==': [{ var: 'b' }, 2] }] }] }, // nested group
    { '+': [{ var: 'score' }, 10] }, // non-boolean expr
    { '!': [{ '==': [{ var: 'a' }, 1] }] }, // negation outside the canon
    { and: 'nope' },
    { '==': [{ var: '' }, 1] },
  ]
  for (const [index, expr] of foreign.entries()) {
    it(`case ${index} → null`, () => {
      expect(decompileGroup(expr)).toBeNull()
    })
  }
})

describe('summaries', () => {
  it('captions choices by label and joins with the combinator', () => {
    const doc = {
      id: 'f',
      blocks: [
        {
          id: 'b1',
          ref: 'plan',
          type: 'multiple_choice',
          title: 'Which plan?',
          properties: { choices: [{ id: 'pro', label: 'Pro' }] },
        },
      ],
      variables: [{ name: 'score' }],
    }
    const g: ConditionGroup = {
      combinator: 'and',
      conditions: [
        { ref: 'plan', op: 'is', value: 'pro' },
        { ref: 'score', op: 'gte', value: 20 },
      ],
    }
    // biome-ignore lint/suspicious/noExplicitAny: minimal doc fixture
    expect(summarizeGroup(doc as any, g)).toBe('Which plan? is Pro and score ≥ 20')
  })
})
