// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'
import type { Condition, ConditionGroup } from './model'

/** Human captions for collapsed rule rows ("plan is Pro · score ≥ 20"). */

const OP_LABEL: Record<Condition['op'], string> = {
  is: 'is',
  is_not: 'is not',
  includes: 'includes',
  not_includes: "doesn't include",
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  answered: 'is answered',
  not_answered: 'is not answered',
}

function fieldLabel(doc: FormDefinition, ref: string): string {
  const block = doc.blocks.find((b) => b.ref === ref)
  if (block !== undefined) return block.title !== '' ? block.title : block.ref
  return ref // variable or hidden field — the slug is the name
}

function valueLabel(doc: FormDefinition, condition: Condition): string {
  const block = doc.blocks.find((b) => b.ref === condition.ref)
  const choices = block?.properties?.choices
  if (Array.isArray(choices)) {
    const match = (choices as { id: string; label?: string }[]).find(
      (c) => c.id === condition.value,
    )
    if (match !== undefined) return match.label ?? match.id
  }
  if (block?.type === 'yes_no') return condition.value === true ? 'Yes' : 'No'
  if (block?.type === 'legal') return condition.value === true ? 'accepted' : 'declined'
  return String(condition.value)
}

export function summarizeCondition(doc: FormDefinition, condition: Condition): string {
  const field = fieldLabel(doc, condition.ref)
  const op = OP_LABEL[condition.op]
  if (condition.op === 'answered' || condition.op === 'not_answered') return `${field} ${op}`
  return `${field} ${op} ${valueLabel(doc, condition)}`
}

export function summarizeGroup(doc: FormDefinition, group: ConditionGroup): string {
  if (group.conditions.length === 0) return 'always'
  const joiner = group.combinator === 'and' ? ' and ' : ' or '
  return group.conditions.map((c) => summarizeCondition(doc, c)).join(joiner)
}
