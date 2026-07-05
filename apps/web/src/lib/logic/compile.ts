// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JsonLogic } from '@formsmithapp/engine'
import type { Condition, ConditionGroup } from './model'

/**
 * UI model → canonical JSONLogic. The canon (always `{and|or:[…]}`, one
 * level, fixed condition shapes) is what `decompile` recognizes — keep the
 * two in lockstep. "Answered" compiles to a null-compare, NOT truthiness:
 * `0` and `false` are real answers.
 */

const v = (ref: string) => ({ var: ref })

export function compileCondition(condition: Condition): JsonLogic {
  const { ref, op } = condition
  const value = condition.value as string | number | boolean
  switch (op) {
    case 'is':
      return { '==': [v(ref), value] }
    case 'is_not':
      return { '!=': [v(ref), value] }
    case 'includes':
      return { in: [value, v(ref)] }
    case 'not_includes':
      return { '!': [{ in: [value, v(ref)] }] }
    case 'gt':
      return { '>': [v(ref), value] }
    case 'gte':
      return { '>=': [v(ref), value] }
    case 'lt':
      return { '<': [v(ref), value] }
    case 'lte':
      return { '<=': [v(ref), value] }
    case 'answered':
      return { '!=': [v(ref), null] }
    case 'not_answered':
      return { '==': [v(ref), null] }
  }
}

export function compileGroup(group: ConditionGroup): JsonLogic {
  // empty group = "always" — literal true (unconditional jump branches)
  if (group.conditions.length === 0) return true
  return { [group.combinator]: group.conditions.map(compileCondition) }
}
