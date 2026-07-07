// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { Block, FormDefinition } from '@formsmithapp/engine'
import { X } from 'lucide-react'
import { SCREEN_TYPES } from '@/lib/builder-store'
import type { Condition, ConditionGroup, ConditionOperator } from '@/lib/logic/model'

/** A referencable field: an earlier answerable block, a variable, or a hidden field. */
export interface FieldOption {
  ref: string
  label: string
  kind: 'block' | 'variable' | 'hidden'
  block?: Block
}

/**
 * Pickers are constrained at the source (engine parity): visibility offers
 * strictly earlier blocks; jump conditions include the owner block itself.
 */
export function conditionFields(
  doc: FormDefinition,
  blockId: string,
  { includeSelf }: { includeSelf: boolean },
): FieldOption[] {
  const index = doc.blocks.findIndex((b) => b.id === blockId)
  const limit = includeSelf ? index + 1 : index
  const fields: FieldOption[] = []
  for (const block of doc.blocks.slice(0, Math.max(limit, 0))) {
    if (SCREEN_TYPES.has(block.type)) continue
    fields.push({
      ref: block.ref,
      label: block.title !== '' ? block.title : block.ref,
      kind: 'block',
      block,
    })
  }
  for (const variable of doc.variables ?? []) {
    fields.push({ ref: variable.name, label: variable.name, kind: 'variable' })
  }
  for (const name of doc.settings?.hiddenFields ?? []) {
    fields.push({ ref: name, label: name, kind: 'hidden' })
  }
  return fields
}

const NUMERIC = new Set(['number', 'opinion_scale', 'nps'])
const CHOICE = new Set(['multiple_choice', 'dropdown'])

export function operatorsFor(field: FieldOption): { op: ConditionOperator; label: string }[] {
  if (field.kind === 'variable') {
    return [
      { op: 'is', label: '=' },
      { op: 'is_not', label: '≠' },
      { op: 'gt', label: '>' },
      { op: 'gte', label: '≥' },
      { op: 'lt', label: '<' },
      { op: 'lte', label: '≤' },
    ]
  }
  if (field.kind === 'hidden') {
    return [
      { op: 'is', label: 'is' },
      { op: 'is_not', label: 'is not' },
      { op: 'answered', label: 'is present' },
    ]
  }
  const type = field.block?.type ?? 'short_text'
  if (type === 'multiple_choice' && field.block?.properties?.multiple === true) {
    return [
      { op: 'includes', label: 'includes' },
      { op: 'not_includes', label: "doesn't include" },
      { op: 'answered', label: 'is answered' },
    ]
  }
  if (CHOICE.has(type) || type === 'yes_no' || type === 'legal') {
    return [
      { op: 'is', label: 'is' },
      { op: 'is_not', label: 'is not' },
      { op: 'answered', label: 'is answered' },
    ]
  }
  if (NUMERIC.has(type)) {
    return [
      { op: 'is', label: '=' },
      { op: 'is_not', label: '≠' },
      { op: 'gt', label: '>' },
      { op: 'gte', label: '≥' },
      { op: 'lt', label: '<' },
      { op: 'lte', label: '≤' },
      { op: 'answered', label: 'is answered' },
    ]
  }
  if (type === 'date') {
    return [
      { op: 'is', label: 'is' },
      { op: 'gt', label: 'is after' },
      { op: 'lt', label: 'is before' },
      { op: 'answered', label: 'is answered' },
    ]
  }
  return [
    { op: 'is', label: 'is' },
    { op: 'is_not', label: 'is not' },
    { op: 'includes', label: 'contains' },
    { op: 'not_includes', label: "doesn't contain" },
    { op: 'answered', label: 'is answered' },
    { op: 'not_answered', label: 'is not answered' },
  ]
}

export function defaultCondition(field: FieldOption): Condition {
  const type = field.block?.type
  if (type !== undefined && (CHOICE.has(type) || type === 'yes_no' || type === 'legal')) {
    const choices = field.block?.properties?.choices
    const first = Array.isArray(choices) ? (choices[0] as { id?: string })?.id : undefined
    if (type === 'yes_no' || type === 'legal') return { ref: field.ref, op: 'is', value: true }
    return {
      ref: field.ref,
      op:
        type === 'multiple_choice' && field.block?.properties?.multiple === true
          ? 'includes'
          : 'is',
      value: first ?? '',
    }
  }
  if (field.kind === 'variable' || (type !== undefined && NUMERIC.has(type))) {
    return { ref: field.ref, op: field.kind === 'variable' ? 'gte' : 'is', value: 0 }
  }
  return { ref: field.ref, op: 'answered' }
}

const selectClass =
  'min-w-0 rounded-[7px] border border-line bg-surface-2 px-1.5 py-1 text-[12px] outline-none focus:border-brand-ring'

function ValueControl({
  field,
  condition,
  onChange,
}: {
  field: FieldOption
  condition: Condition
  onChange: (value: string | number | boolean) => void
}) {
  const type = field.block?.type
  const choices = field.block?.properties?.choices
  if (Array.isArray(choices)) {
    return (
      <select
        aria-label="Condition value"
        className={selectClass}
        value={String(condition.value ?? '')}
        onChange={(e) => onChange(e.target.value)}
      >
        {(choices as { id: string; label?: string }[]).map((c) => (
          <option key={c.id} value={c.id}>
            {c.label ?? c.id}
          </option>
        ))}
      </select>
    )
  }
  if (type === 'yes_no' || type === 'legal') {
    return (
      <select
        aria-label="Condition value"
        className={selectClass}
        value={condition.value === true ? 'true' : 'false'}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">{type === 'yes_no' ? 'Yes' : 'Accepted'}</option>
        <option value="false">{type === 'yes_no' ? 'No' : 'Declined'}</option>
      </select>
    )
  }
  const numeric = field.kind === 'variable' || (type !== undefined && NUMERIC.has(type))
  return (
    <input
      aria-label="Condition value"
      className={`${selectClass} w-20 flex-1`}
      inputMode={numeric ? 'decimal' : undefined}
      placeholder={type === 'date' ? 'YYYY-MM-DD' : 'value'}
      value={String(condition.value ?? '')}
      onChange={(e) => onChange(numeric ? Number(e.target.value) || 0 : e.target.value)}
    />
  )
}

/** The condition-group editor: ALL/ANY + rows of field · operator · value. */
export function GroupEditor({
  fields,
  group,
  onChange,
  emptyHint,
}: {
  fields: FieldOption[]
  group: ConditionGroup
  onChange: (group: ConditionGroup) => void
  emptyHint: string
}) {
  const fieldFor = (ref: string) => fields.find((f) => f.ref === ref)
  const setCondition = (index: number, condition: Condition) =>
    onChange({
      ...group,
      conditions: group.conditions.map((c, i) => (i === index ? condition : c)),
    })

  return (
    <div className="space-y-2">
      {group.conditions.length > 1 && (
        <div
          className="flex gap-0.5 rounded-[8px] bg-surface-hover p-0.5"
          role="radiogroup"
          aria-label="Combinator"
        >
          {(['and', 'or'] as const).map((mode) => (
            // biome-ignore lint/a11y/useSemanticElements: combinator radiogroup of toggle buttons, not native radios
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={group.combinator === mode}
              onClick={() => onChange({ ...group, combinator: mode })}
              className={`flex-1 rounded-[7px] px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                group.combinator === mode ? 'bg-surface-2 shadow-sm' : 'text-fg-2'
              }`}
            >
              {mode === 'and' ? 'All' : 'Any'}
            </button>
          ))}
        </div>
      )}
      {group.conditions.map((condition, index) => {
        const field = fieldFor(condition.ref) ?? fields[0]
        if (field === undefined) return null
        const operators = operatorsFor(field)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional edits
          <div key={index} className="flex items-center gap-1.5">
            <select
              aria-label="Condition field"
              className={`${selectClass} max-w-[38%] flex-1 truncate`}
              value={condition.ref}
              onChange={(e) => {
                const next = fieldFor(e.target.value)
                if (next !== undefined) setCondition(index, defaultCondition(next))
              }}
            >
              {fields.map((f) => (
                <option key={f.ref} value={f.ref}>
                  {f.kind === 'variable'
                    ? `Σ ${f.label}`
                    : f.kind === 'hidden'
                      ? `# ${f.label}`
                      : f.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Condition operator"
              className={selectClass}
              value={condition.op}
              onChange={(e) => {
                const op = e.target.value as ConditionOperator
                const valueless = op === 'answered' || op === 'not_answered'
                setCondition(index, {
                  ref: condition.ref,
                  op,
                  ...(valueless ? {} : { value: condition.value ?? defaultCondition(field).value }),
                })
              }}
            >
              {operators.map((o) => (
                <option key={o.op} value={o.op}>
                  {o.label}
                </option>
              ))}
            </select>
            {condition.op !== 'answered' && condition.op !== 'not_answered' && (
              <ValueControl
                field={field}
                condition={condition}
                onChange={(value) => setCondition(index, { ...condition, value })}
              />
            )}
            <button
              type="button"
              aria-label="Remove condition"
              onClick={() =>
                onChange({ ...group, conditions: group.conditions.filter((_, i) => i !== index) })
              }
              className="grid size-5 shrink-0 place-items-center rounded text-fg-3 hover:text-error"
            >
              <X size={11} />
            </button>
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => {
          const first = fields[0]
          if (first !== undefined)
            onChange({ ...group, conditions: [...group.conditions, defaultCondition(first)] })
        }}
        disabled={fields.length === 0}
        className="text-[12px] font-medium text-brand disabled:opacity-40"
      >
        + Add condition
      </button>
      {group.conditions.length === 0 && <p className="text-[11px] text-fg-3">{emptyHint}</p>}
    </div>
  )
}
