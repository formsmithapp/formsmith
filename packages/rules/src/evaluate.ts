// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Rule compilation and evaluation on top of `json-logic-engine`'s sync
 * `LogicEngine`. Every AST is validated before it reaches the engine, and
 * evaluation fails closed: any runtime error yields `null` (a throwing rule
 * means "falsy") instead of propagating.
 */

import { LogicEngine } from 'json-logic-engine'

import { type RuleValidationOptions, validateRuleAst } from './validate'

/** Thrown by {@link compileRule} / {@link evaluateRule} when the AST is invalid. */
export class RuleValidationError extends Error {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super(`invalid rule: ${issues.join('; ')}`)
    this.name = 'RuleValidationError'
    this.issues = issues
  }
}

export type RuleData = Record<string, unknown>

export type CompiledRule = (data: RuleData) => unknown

/** Single module-scoped sync engine. Only validated ASTs ever reach it. */
const engine = new LogicEngine()

const assertValid = (expr: unknown, options: RuleValidationOptions): void => {
  const result = validateRuleAst(expr, options)
  if (!result.ok) throw new RuleValidationError(result.issues)
}

/**
 * Validates and compiles a rule into a reusable function.
 *
 * Throws {@link RuleValidationError} if the AST is invalid. The returned
 * function never throws: any runtime evaluation error is caught and `null` is
 * returned instead (rules fail closed). Note that `json-logic-engine` throws
 * non-`Error` values at runtime — e.g. division by zero throws the primitive
 * `NaN` — so the catch is deliberately untyped.
 */
export function compileRule(expr: unknown, options: RuleValidationOptions): CompiledRule {
  assertValid(expr, options)
  let run: (data: RuleData) => unknown
  try {
    // json-logic-engine constant-folds literal subtrees at build time, so a
    // rule like {'/': [1, 0]} throws here rather than at call time. Fail
    // closed the same way: compile it to a rule that always yields null.
    run = engine.build(expr) as (data: RuleData) => unknown
  } catch {
    return () => null
  }
  return (data) => {
    try {
      return run(data)
    } catch {
      return null
    }
  }
}

/**
 * Validates a rule and evaluates it once against `data`.
 *
 * Throws {@link RuleValidationError} if the AST is invalid; runtime
 * evaluation errors yield `null` (fail closed), same as {@link compileRule}.
 */
export function evaluateRule(
  expr: unknown,
  data: RuleData,
  options: RuleValidationOptions,
): unknown {
  assertValid(expr, options)
  try {
    return engine.run(expr, data) as unknown
  } catch {
    return null
  }
}
