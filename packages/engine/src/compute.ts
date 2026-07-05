// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { buildRuleData, isTruthy, type ParsedForm } from './parse'

function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

export function initialVariables(parsed: ParsedForm): Record<string, unknown> {
  const variables: Record<string, unknown> = {}
  for (const variable of parsed.variables) {
    variables[variable.name] =
      variable.initialValue !== undefined
        ? variable.initialValue
        : variable.type === 'number'
          ? 0
          : null
  }
  return variables
}

/**
 * Deterministic full recompute: initial values, then every calculation rule in
 * `form.logic` order whose condition holds. Recomputing from scratch keeps `add`
 * idempotent — answers can change without double-applying scores. Non-numeric
 * operands coerce to 0 so scoring never poisons to NaN.
 */
export function computeVariables(
  parsed: ParsedForm,
  answers: Record<string, unknown>,
  hidden: Record<string, string>,
): Record<string, unknown> {
  const variables = initialVariables(parsed)
  for (const calc of parsed.calculations) {
    const data = buildRuleData(answers, variables, hidden)
    if (!isTruthy(calc.when(data))) continue
    const raw = calc.value !== null ? calc.value(data) : calc.literal
    if (calc.op === 'add') {
      variables[calc.variable] = toNumber(variables[calc.variable]) + toNumber(raw)
    } else {
      variables[calc.variable] = raw
    }
  }
  return variables
}
