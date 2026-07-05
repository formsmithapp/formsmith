// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Validation of untrusted JSONLogic ASTs.
 *
 * Rules arrive as user-authored JSON, so before anything is evaluated the AST
 * is checked against an operator allowlist, bounded depth and node count, and
 * a set of known refs that `var` / `missing` / `missing_some` paths must
 * resolve into. Validation collects every issue it finds in one pass instead
 * of stopping at the first.
 */

export interface RuleLimits {
  /** Maximum nesting depth. The root node is depth 1. Default: 12. */
  maxDepth?: number
  /** Maximum total node count (primitives, arrays, operator objects). Default: 256. */
  maxNodes?: number
}

export interface RuleValidationOptions {
  /**
   * Identifiers a rule is allowed to reference. The first dot-segment of every
   * `var` / `missing` / `missing_some` path must be in this set.
   */
  knownRefs: Iterable<string>
  limits?: RuleLimits
  /** Operator allowlist. Default: {@link DEFAULT_ALLOWED_OPERATORS}. */
  allowedOperators?: readonly string[]
}

export const DEFAULT_LIMITS: Readonly<Required<RuleLimits>> = Object.freeze({
  maxDepth: 12,
  maxNodes: 256,
})

/**
 * Operators a rule may use by default. Iteration/higher-order operators
 * (`map`, `filter`, `reduce`, …) and engine extensions (`val`, `exists`,
 * `throw`, `try`, …) are deliberately excluded.
 */
export const DEFAULT_ALLOWED_OPERATORS: readonly string[] = Object.freeze([
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

export type RuleValidationResult = { ok: true } | { ok: false; issues: string[] }

/** Returns the first dot-segment of a `var`/`missing` path (`'a.b.c'` → `'a'`). */
const firstSegment = (path: string): string => {
  const dot = path.indexOf('.')
  return dot === -1 ? path : path.slice(0, dot)
}

/** Short human-readable description of a value for issue messages. */
const describeValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  if (typeof value === 'object') {
    const name = value.constructor?.name
    return name && name !== 'Object' ? `an instance of ${name}` : 'an object'
  }
  return `a ${typeof value}`
}

/**
 * Validates an untrusted JSONLogic AST without evaluating it.
 *
 * A valid node is a primitive literal (`string | number | boolean | null`),
 * an array of valid nodes, or a plain object with exactly one operator key
 * from the allowlist whose argument is itself a valid node (or array of
 * nodes). All issues found are collected and returned together.
 */
export function validateRuleAst(
  expr: unknown,
  options: RuleValidationOptions,
): RuleValidationResult {
  const knownRefs = new Set(options.knownRefs)
  const maxDepth = options.limits?.maxDepth ?? DEFAULT_LIMITS.maxDepth
  const maxNodes = options.limits?.maxNodes ?? DEFAULT_LIMITS.maxNodes
  const allowedOperators = new Set(options.allowedOperators ?? DEFAULT_ALLOWED_OPERATORS)

  const issues: string[] = []
  let nodeCount = 0
  let nodesExceeded = false
  let depthExceeded = false

  /**
   * Charges one node against the budget and checks the depth cap. Returns
   * false when a cap is hit — callers must stop recursing so a depth or size
   * bomb cannot stack-overflow the validator. Each cap reports one issue.
   */
  const enter = (depth: number): boolean => {
    if (nodesExceeded) return false
    nodeCount += 1
    if (nodeCount > maxNodes) {
      nodesExceeded = true
      issues.push(`rule exceeds the maximum node count of ${maxNodes}`)
      return false
    }
    if (depth > maxDepth) {
      if (!depthExceeded) {
        depthExceeded = true
        issues.push(`rule exceeds the maximum depth of ${maxDepth}`)
      }
      return false
    }
    return true
  }

  const checkRef = (path: string): void => {
    const segment = firstSegment(path)
    if (!knownRefs.has(segment)) issues.push(`unknown ref: ${segment}`)
  }

  /** `var` arguments: `'path'`, `['path']`, or `['path', default]`. */
  const visitVar = (args: unknown, depth: number): void => {
    if (typeof args === 'string') {
      if (!enter(depth)) return
      if (args === '') {
        issues.push('"var" path must be a non-empty string (whole-context access is not allowed)')
      } else {
        checkRef(args)
      }
      return
    }
    if (Array.isArray(args)) {
      if (!enter(depth)) return
      if (args.length === 0 || args.length > 2) {
        issues.push('"var" arguments must be [path] or [path, default]')
        return
      }
      const path = args[0]
      if (!enter(depth + 1)) return
      if (typeof path !== 'string' || path === '') {
        issues.push('"var" path must be a non-empty string')
      } else {
        checkRef(path)
      }
      if (args.length === 2) visit(args[1], depth + 1)
      return
    }
    if (!enter(depth)) return
    issues.push(`"var" path must be a non-empty string, got ${describeValue(args)}`)
  }

  /** `missing` arguments: one literal string ref, or an array of them. */
  const visitMissing = (args: unknown, depth: number): void => {
    if (typeof args === 'string') {
      if (!enter(depth)) return
      checkRef(args)
      return
    }
    if (Array.isArray(args)) {
      if (!enter(depth)) return
      for (const element of args) {
        if (!enter(depth + 1)) return
        if (typeof element === 'string') {
          checkRef(element)
        } else {
          issues.push(`"missing" arguments must be literal strings, got ${describeValue(element)}`)
        }
      }
      return
    }
    if (!enter(depth)) return
    issues.push(`"missing" arguments must be literal strings, got ${describeValue(args)}`)
  }

  /** `missing_some` arguments: the literal shape `[number, [refs...]]`. */
  const visitMissingSome = (args: unknown, depth: number): void => {
    if (!enter(depth)) return
    if (!Array.isArray(args) || args.length !== 2) {
      issues.push('"missing_some" arguments must be [count, [refs...]]')
      return
    }
    const count = args[0]
    const refs = args[1]
    if (!enter(depth + 1)) return
    if (typeof count !== 'number') {
      issues.push(`"missing_some" count must be a literal number, got ${describeValue(count)}`)
    }
    if (!enter(depth + 1)) return
    if (!Array.isArray(refs)) {
      issues.push(
        `"missing_some" refs must be an array of literal strings, got ${describeValue(refs)}`,
      )
      return
    }
    for (const element of refs) {
      if (!enter(depth + 2)) return
      if (typeof element === 'string') {
        checkRef(element)
      } else {
        issues.push(`"missing_some" refs must be literal strings, got ${describeValue(element)}`)
      }
    }
  }

  const visit = (node: unknown, depth: number): void => {
    if (!enter(depth)) return

    if (
      node === null ||
      typeof node === 'string' ||
      typeof node === 'number' ||
      typeof node === 'boolean'
    ) {
      return
    }
    if (node === undefined) {
      issues.push('undefined is not a valid rule node')
      return
    }
    if (typeof node === 'function') {
      issues.push('functions are not valid rule nodes')
      return
    }
    if (typeof node === 'symbol') {
      issues.push('symbols are not valid rule nodes')
      return
    }
    if (typeof node === 'bigint') {
      issues.push('bigints are not valid rule nodes')
      return
    }

    if (Array.isArray(node)) {
      for (const element of node) {
        visit(element, depth + 1)
        if (nodesExceeded) return
      }
      return
    }

    const proto = Object.getPrototypeOf(node)
    if (proto !== Object.prototype && proto !== null) {
      issues.push(`non-plain objects are not valid rule nodes, got ${describeValue(node)}`)
      return
    }

    const keys = Object.keys(node)
    const operator = keys[0]
    if (keys.length !== 1 || operator === undefined) {
      issues.push(`a JSONLogic node must have exactly one operator key, got ${keys.length}`)
      return
    }

    if (!allowedOperators.has(operator)) {
      issues.push(`unknown or disallowed operator: "${operator}"`)
      return
    }

    const args = (node as Record<string, unknown>)[operator]
    if (operator === 'var') {
      visitVar(args, depth + 1)
    } else if (operator === 'missing') {
      visitMissing(args, depth + 1)
    } else if (operator === 'missing_some') {
      visitMissingSome(args, depth + 1)
    } else {
      visit(args, depth + 1)
    }
  }

  visit(expr, 1)

  return issues.length === 0 ? { ok: true } : { ok: false, issues }
}

/**
 * Collects the first dot-segment of every data reference (`var`, `missing`,
 * `missing_some`) in a rule AST — e.g. for ordering checks like "a jump
 * condition may only read earlier blocks". Intended for ASTs that already
 * passed {@link validateRuleAst} (bounded depth); unrecognized shapes are
 * skipped, never reported.
 */
export function collectRuleRefs(expr: unknown): Set<string> {
  const refs = new Set<string>()
  const addPath = (path: unknown): void => {
    if (typeof path === 'string' && path !== '') refs.add(firstSegment(path))
  }
  const visit = (node: unknown): void => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const element of node) visit(element)
      return
    }
    const keys = Object.keys(node)
    const operator = keys[0]
    if (keys.length !== 1 || operator === undefined) return
    const args = (node as Record<string, unknown>)[operator]
    if (operator === 'var') {
      if (Array.isArray(args)) {
        addPath(args[0])
        if (args.length === 2) visit(args[1])
      } else {
        addPath(args)
      }
      return
    }
    if (operator === 'missing') {
      if (Array.isArray(args)) {
        for (const element of args) addPath(element)
      } else {
        addPath(args)
      }
      return
    }
    if (operator === 'missing_some') {
      if (Array.isArray(args) && Array.isArray(args[1])) {
        for (const element of args[1]) addPath(element)
      }
      return
    }
    visit(args)
  }
  visit(expr)
  return refs
}
