// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The builder's condition model — the UI-facing shape that compiles to
 * canonical JSONLogic and back. JSONLogic in `form.logic` stays the single
 * source of truth; this model exists only while editing.
 */

export type ConditionOperator =
  | 'is'
  | 'is_not'
  | 'includes'
  | 'not_includes'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'answered'
  | 'not_answered'

export interface Condition {
  ref: string
  op: ConditionOperator
  /** Absent for answered/not_answered. */
  value?: string | number | boolean
}

export interface ConditionGroup {
  combinator: 'and' | 'or'
  conditions: Condition[]
}

export interface JumpBranch {
  /** Rule id (stable across edits so reordering is traceable). */
  id: string
  group: ConditionGroup
  /** Destination block id — forward-only in the builder UI. */
  targetId: string
}

export interface ScoringRule {
  id: string
  group: ConditionGroup
  op: 'add' | 'set'
  amount: number
  variable: string
}

export const newRuleId = () => `r_${crypto.randomUUID().slice(0, 8)}`

export const emptyGroup = (): ConditionGroup => ({ combinator: 'and', conditions: [] })

/** Operators that carry no comparison value. */
export const VALUELESS_OPS: ReadonlySet<ConditionOperator> = new Set(['answered', 'not_answered'])
