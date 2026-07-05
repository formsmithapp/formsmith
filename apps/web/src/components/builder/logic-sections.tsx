// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { Block } from '@formsmithapp/engine'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { SCREEN_TYPES } from '@/lib/builder-store'
import { getJumps, getScoring, getVisibility } from '@/lib/logic/edits'
import { emptyGroup, newRuleId } from '@/lib/logic/model'
import { summarizeGroup } from '@/lib/logic/summarize'
import { conditionFields, defaultCondition, GroupEditor } from './logic-ui'
import { useBuilder, useBuilderState } from './store-context'

/** "Show this block when…" — one visibility rule per block. */
export function VisibilitySection({ block }: { block: Block }) {
  const store = useBuilder()
  const { doc } = useBuilderState()
  const { group, advanced } = getVisibility(doc, block)
  const fields = conditionFields(doc, block.id, { includeSelf: false })

  if (advanced) {
    return (
      <AdvancedNote onRemove={() => store.setVisibilityGroup(block.id, null)}>
        This block has an advanced visibility rule (authored via the API).
      </AdvancedNote>
    )
  }
  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-fg-2">Show this block when…</p>
      <GroupEditor
        fields={fields}
        group={group ?? emptyGroup()}
        onChange={(next) => store.setVisibilityGroup(block.id, next)}
        emptyHint={
          fields.length === 0
            ? 'Add earlier questions to condition on.'
            : 'No conditions — always shown.'
        }
      />
    </div>
  )
}

/** "After this block…" — ordered forward-only jump branches, first match wins. */
export function JumpsSection({ block }: { block: Block }) {
  const store = useBuilder()
  const { doc } = useBuilderState()
  const branches = getJumps(doc, block.id)
  const fields = conditionFields(doc, block.id, { includeSelf: true })
  const index = doc.blocks.findIndex((b) => b.id === block.id)
  const destinations = doc.blocks.filter(
    (b, i) =>
      i > index && (b.type === 'thankyou' || !SCREEN_TYPES.has(b.type) || b.type === 'statement'),
  )

  const commit = (
    next: { id: string; targetId: string; group: ReturnType<typeof emptyGroup> | null }[],
  ) =>
    store.setJumpBranches(
      block.id,
      next.map((b) => ({ id: b.id, targetId: b.targetId, group: b.group ?? emptyGroup() })),
    )

  const move = (from: number, to: number) => {
    if (to < 0 || to >= branches.length) return
    const next = [...branches]
    const [item] = next.splice(from, 1)
    if (item !== undefined) next.splice(to, 0, item)
    commit(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] font-medium text-fg-2">After this block…</p>
      {branches.map((branch, i) => (
        <div key={branch.id} className="rounded-[10px] border border-line-soft bg-surface-2 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow text-fg-3">Jump {i + 1}</span>
            <span className="flex gap-0.5">
              <IconBtn label="Move up" onClick={() => move(i, i - 1)} disabled={i === 0}>
                <ArrowUp size={11} />
              </IconBtn>
              <IconBtn
                label="Move down"
                onClick={() => move(i, i + 1)}
                disabled={i === branches.length - 1}
              >
                <ArrowDown size={11} />
              </IconBtn>
              <IconBtn
                label="Delete jump"
                onClick={() => commit(branches.filter((b) => b.id !== branch.id))}
              >
                <Trash2 size={11} />
              </IconBtn>
            </span>
          </div>
          {branch.group === null ? (
            <p className="text-[11.5px] text-fg-3 italic">
              Advanced rule (API-authored) — read-only.
            </p>
          ) : (
            <GroupEditor
              fields={fields}
              group={branch.group}
              onChange={(group) =>
                commit(branches.map((b) => (b.id === branch.id ? { ...b, group } : b)))
              }
              emptyHint="No conditions — always jumps."
            />
          )}
          <label className="mt-2 flex items-center gap-2 text-[12px] text-fg-2">
            go to
            <select
              aria-label="Jump destination"
              className="min-w-0 flex-1 rounded-[7px] border border-line bg-surface px-1.5 py-1 text-[12px]"
              value={branch.targetId}
              onChange={(e) =>
                commit(
                  branches.map((b) =>
                    b.id === branch.id ? { ...b, targetId: e.target.value } : b,
                  ),
                )
              }
            >
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title !== '' ? d.title : d.ref}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
      <button
        type="button"
        disabled={destinations.length === 0}
        onClick={() => {
          const target = destinations[0]
          if (target !== undefined)
            commit([...branches, { id: newRuleId(), targetId: target.id, group: emptyGroup() }])
        }}
        className="text-[12px] font-medium text-brand disabled:opacity-40"
      >
        + Add jump
      </button>
      <p className="text-[11px] text-fg-3">Otherwise → next block in order.</p>
    </div>
  )
}

/** "Scoring" — when ⟨conditions⟩ → add/set ⟨n⟩ to ⟨variable⟩. */
export function ScoringSection({ block }: { block: Block }) {
  const store = useBuilder()
  const { doc } = useBuilderState()
  const rows = getScoring(doc, block.id)
  const fields = conditionFields(doc, block.id, { includeSelf: true })
  const variables = doc.variables ?? []
  const self = fields.find((f) => f.ref === block.ref)

  const commit = (next: typeof rows) =>
    store.setScoringRules(
      block.id,
      next.map((r) => ({
        id: r.id,
        variable: r.variable,
        op: r.op,
        amount: r.amount,
        group: r.group ?? emptyGroup(),
      })),
    )

  if (variables.length === 0) {
    return (
      <button
        type="button"
        onClick={() => store.setVariables([{ name: 'score', type: 'number', initialValue: 0 }])}
        className="text-[12px] font-medium text-brand"
      >
        + Create a “score” variable to start scoring
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <div key={row.id} className="rounded-[10px] border border-line-soft bg-surface-2 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow text-fg-3">
              {summarizeGroup(doc, row.group ?? emptyGroup()).slice(0, 34)}
            </span>
            <IconBtn
              label="Delete scoring rule"
              onClick={() => commit(rows.filter((r) => r.id !== row.id))}
            >
              <Trash2 size={11} />
            </IconBtn>
          </div>
          {row.group === null ? (
            <p className="text-[11.5px] text-fg-3 italic">Advanced rule — read-only.</p>
          ) : (
            <GroupEditor
              fields={fields}
              group={row.group}
              onChange={(group) => commit(rows.map((r) => (r.id === row.id ? { ...r, group } : r)))}
              emptyHint="No conditions — applies on every response."
            />
          )}
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-2">
            <select
              aria-label="Scoring operation"
              className="rounded-[7px] border border-line bg-surface px-1.5 py-1 text-[12px]"
              value={row.op}
              onChange={(e) =>
                commit(
                  rows.map((r) =>
                    r.id === row.id ? { ...r, op: e.target.value as 'add' | 'set' } : r,
                  ),
                )
              }
            >
              <option value="add">add</option>
              <option value="set">set</option>
            </select>
            <input
              aria-label="Scoring amount"
              inputMode="decimal"
              className="w-16 rounded-[7px] border border-line bg-surface px-1.5 py-1 text-[12px]"
              value={row.amount}
              onChange={(e) =>
                commit(
                  rows.map((r) =>
                    r.id === row.id ? { ...r, amount: Number(e.target.value) || 0 } : r,
                  ),
                )
              }
            />
            <span>{row.op === 'add' ? 'to' : 'on'}</span>
            <select
              aria-label="Scoring variable"
              className="min-w-0 flex-1 rounded-[7px] border border-line bg-surface px-1.5 py-1 text-[12px]"
              value={row.variable}
              onChange={(e) =>
                commit(rows.map((r) => (r.id === row.id ? { ...r, variable: e.target.value } : r)))
              }
            >
              {variables.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          const variable = variables[0]
          if (variable === undefined) return
          commit([
            ...rows,
            {
              id: newRuleId(),
              variable: variable.name,
              op: 'add',
              amount: 10,
              group:
                self !== undefined
                  ? { combinator: 'and', conditions: [defaultCondition(self)] }
                  : emptyGroup(),
            },
          ])
        }}
        className="text-[12px] font-medium text-brand"
      >
        + Add scoring rule
      </button>
    </div>
  )
}

function AdvancedNote({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="rounded-[10px] border border-line-soft border-dashed p-2.5 text-[11.5px] text-fg-3 italic">
      {children}
      <button type="button" onClick={onRemove} className="ml-1.5 font-medium text-error not-italic">
        Remove
      </button>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-5 place-items-center rounded text-fg-3 hover:text-fg disabled:opacity-30"
    >
      {children}
    </button>
  )
}
