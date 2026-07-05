// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Condition, ConditionGroup, ConditionOperator } from './model'

/**
 * Canonical JSONLogic → UI model. Strict by design: anything outside the
 * canon (nested groups, other operators, computed operands — i.e. rules
 * authored via the API) returns `null` and the builder renders it as a
 * read-only "Advanced rule" instead of guessing.
 */

type Dict = Record<string, unknown>

const isDict = (x: unknown): x is Dict =>
  typeof x === 'object' && x !== null && !Array.isArray(x) && Object.keys(x).length === 1

const isLiteral = (x: unknown): x is string | number | boolean =>
  typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'

/** `{var: 'ref'}` → 'ref' */
function asVar(x: unknown): string | null {
  if (!isDict(x) || !('var' in x)) return null
  return typeof x.var === 'string' && x.var !== '' ? x.var : null
}

const COMPARE: Record<string, ConditionOperator> = {
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
}

function decompileCondition(node: unknown): Condition | null {
  if (!isDict(node)) return null
  const [op] = Object.keys(node)
  const args = node[op as keyof typeof node]

  if ((op === '==' || op === '!=') && Array.isArray(args) && args.length === 2) {
    const ref = asVar(args[0])
    if (ref === null) return null
    if (args[1] === null) return { ref, op: op === '!=' ? 'answered' : 'not_answered' }
    if (!isLiteral(args[1])) return null
    return { ref, op: op === '==' ? 'is' : 'is_not', value: args[1] }
  }
  if (op !== undefined && op in COMPARE && Array.isArray(args) && args.length === 2) {
    const ref = asVar(args[0])
    const operator = COMPARE[op]
    if (ref === null || !isLiteral(args[1]) || operator === undefined) return null
    return { ref, op: operator, value: args[1] }
  }
  if (op === 'in' && Array.isArray(args) && args.length === 2) {
    const ref = asVar(args[1])
    if (ref === null || !isLiteral(args[0])) return null
    return { ref, op: 'includes', value: args[0] }
  }
  if (op === '!' && Array.isArray(args) && args.length === 1) {
    const inner = decompileCondition(args[0])
    if (inner?.op === 'includes') return { ...inner, op: 'not_includes' }
    return null
  }
  return null
}

export function decompileGroup(expr: unknown): ConditionGroup | null {
  if (expr === true) return { combinator: 'and', conditions: [] } // "always"
  if (!isDict(expr)) return null
  const [combinator] = Object.keys(expr)
  if (combinator !== 'and' && combinator !== 'or') return null
  const items = expr[combinator]
  if (!Array.isArray(items)) return null
  const conditions: Condition[] = []
  for (const item of items) {
    const condition = decompileCondition(item)
    if (condition === null) return null
    conditions.push(condition)
  }
  return { combinator, conditions }
}
