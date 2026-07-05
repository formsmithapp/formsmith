// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block, FormDefinition, Rule, Variable } from '@formsmithapp/engine'
import { collectRuleRefs } from '@formsmithapp/rules'
import { compileGroup } from './compile'
import { decompileGroup } from './decompile'
import { type ConditionGroup, type JumpBranch, newRuleId, type ScoringRule } from './model'

/**
 * Pure document transformations for logic editing — the store calls these
 * inside `commit()`. Referential integrity lives HERE: deleting/renaming a
 * block (or variable/hidden field) cascades through every rule and every
 * piping token, and duplication deep-clones rules. Canonical rules are
 * pruned condition-by-condition; foreign ("advanced") rules that reference
 * a removed name are dropped whole — the engine would reject them anyway.
 */

const logicOf = (doc: FormDefinition): Rule[] => doc.logic ?? []

/* ---------- expr utilities ---------- */

/** Rewrites every `var` first-segment `oldRef` → `newRef` in an expr tree. */
function rewriteVars(expr: unknown, oldRef: string, newRef: string): unknown {
  if (Array.isArray(expr)) return expr.map((item) => rewriteVars(item, oldRef, newRef))
  if (typeof expr === 'object' && expr !== null) {
    const entries = Object.entries(expr as Record<string, unknown>)
    if (entries.length === 1 && entries[0] !== undefined && entries[0][0] === 'var') {
      const path = entries[0][1]
      if (typeof path === 'string') {
        const [head, ...rest] = path.split('.')
        if (head === oldRef) return { var: [newRef, ...rest].join('.') }
      }
      return expr
    }
    return Object.fromEntries(entries.map(([k, v]) => [k, rewriteVars(v, oldRef, newRef)]))
  }
  return expr
}

const TOKEN = (ref: string) => new RegExp(`\\{\\{\\s*${ref}(\\.[A-Za-z0-9_.-]+)?\\s*\\}\\}`, 'g')

function rewriteTokens(text: string | undefined, oldRef: string, newRef: string) {
  return text?.replace(TOKEN(oldRef), (match) => match.replace(oldRef, newRef))
}

function stripTokens(text: string | undefined, ref: string) {
  return text?.replace(TOKEN(ref), '')
}

/** Prunes conditions on `ref` from a canonical expr; null = drop the rule. */
function pruneExpr(expr: unknown, ref: string): unknown | null {
  const group = decompileGroup(expr)
  if (group === null) {
    // foreign rule: drop it entirely if it reads the removed name
    return collectRuleRefs(expr).has(ref) ? null : expr
  }
  const kept = group.conditions.filter((c) => c.ref !== ref)
  if (kept.length === group.conditions.length) return expr
  if (kept.length === 0) return null
  return compileGroup({ ...group, conditions: kept })
}

/* ---------- per-block rule getters (panel state) ---------- */

export interface VisibilityState {
  group: ConditionGroup | null
  /** True when a rule exists but isn't canonical (API-authored). */
  advanced: boolean
}

export function getVisibility(doc: FormDefinition, block: Block): VisibilityState {
  if (block.visibility === undefined) return { group: null, advanced: false }
  const rule = logicOf(doc).find((r) => r.id === block.visibility)
  if (rule === undefined) return { group: null, advanced: false }
  const group = decompileGroup(rule.expr)
  return group === null ? { group: null, advanced: true } : { group, advanced: false }
}

export interface JumpBranchState {
  id: string
  targetId: string
  /** null = advanced (read-only) branch. */
  group: ConditionGroup | null
}

export function getJumps(doc: FormDefinition, blockId: string): JumpBranchState[] {
  return logicOf(doc)
    .filter((r) => r.kind === 'jump' && r.owner?.ref === blockId)
    .map((r) => ({
      id: r.id,
      targetId: r.action?.target ?? '',
      group: decompileGroup(r.expr),
    }))
}

export interface ScoringRuleState {
  id: string
  variable: string
  op: 'add' | 'set'
  amount: number
  group: ConditionGroup | null
}

export function getScoring(doc: FormDefinition, blockId: string): ScoringRuleState[] {
  return logicOf(doc)
    .filter((r) => r.kind === 'calculation' && r.owner?.ref === blockId)
    .map((r) => ({
      id: r.id,
      variable: r.action?.variable ?? '',
      op: r.action?.op === 'set' ? 'set' : 'add',
      amount: typeof r.action?.value === 'number' ? r.action.value : 0,
      group: decompileGroup(r.expr),
    }))
}

/* ---------- per-block rule setters ---------- */

export function setVisibility(
  doc: FormDefinition,
  blockId: string,
  group: ConditionGroup | null,
): FormDefinition {
  const block = doc.blocks.find((b) => b.id === blockId)
  if (block === undefined) return doc
  const logic = logicOf(doc).filter((r) => r.id !== block.visibility)
  if (group === null || group.conditions.length === 0) {
    return {
      ...doc,
      logic,
      blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, visibility: undefined } : b)),
    }
  }
  const rule: Rule = {
    id: newRuleId(),
    kind: 'visibility',
    owner: { type: 'block', ref: blockId },
    expr: compileGroup(group),
  }
  return {
    ...doc,
    logic: [...logic, rule],
    blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, visibility: rule.id } : b)),
  }
}

export function setJumps(
  doc: FormDefinition,
  blockId: string,
  branches: JumpBranch[],
): FormDefinition {
  const kept = logicOf(doc).filter((r) => !(r.kind === 'jump' && r.owner?.ref === blockId))
  const rules: Rule[] = branches.map((branch) => ({
    id: branch.id,
    kind: 'jump',
    owner: { type: 'block', ref: blockId },
    expr: compileGroup(branch.group),
    action: { target: branch.targetId },
  }))
  return { ...doc, logic: [...kept, ...rules] }
}

export function setScoring(
  doc: FormDefinition,
  blockId: string,
  rows: ScoringRule[],
): FormDefinition {
  const kept = logicOf(doc).filter((r) => !(r.kind === 'calculation' && r.owner?.ref === blockId))
  const rules: Rule[] = rows.map((row) => ({
    id: row.id,
    kind: 'calculation',
    owner: { type: 'block', ref: blockId },
    expr: compileGroup(row.group),
    action: { variable: row.variable, op: row.op, value: row.amount },
  }))
  return { ...doc, logic: [...kept, ...rules] }
}

/* ---------- cascades ---------- */

/** Everything that must happen when a name (block ref / variable / hidden) disappears. */
function pruneName(doc: FormDefinition, ref: string): FormDefinition {
  const dropped = new Set<string>()
  const logic: Rule[] = []
  for (const rule of logicOf(doc)) {
    if (rule.kind === 'calculation' && rule.action?.variable === ref) {
      dropped.add(rule.id)
      continue
    }
    const pruned = pruneExpr(rule.expr, ref)
    if (pruned === null) dropped.add(rule.id)
    else logic.push(pruned === rule.expr ? rule : { ...rule, expr: pruned })
  }
  const blocks = doc.blocks.map((b) => {
    const cleaned: Block = {
      ...b,
      title: stripTokens(b.title, ref) ?? b.title,
      description: stripTokens(b.description, ref),
      visibility:
        b.visibility !== undefined && dropped.has(b.visibility) ? undefined : b.visibility,
    }
    return cleaned
  })
  return { ...doc, logic, blocks }
}

/** Full cascade for deleting a block: owned rules, targeting branches, references, tokens. */
export function removeBlockCascade(doc: FormDefinition, block: Block): FormDefinition {
  const logic = logicOf(doc).filter(
    (r) => r.owner?.ref !== block.id && r.action?.target !== block.id,
  )
  return pruneName({ ...doc, logic }, block.ref)
}

/** Rename cascade: every rule `var`, every calc target, every piping token. */
export function renameRefCascade(
  doc: FormDefinition,
  oldRef: string,
  newRef: string,
): FormDefinition {
  const logic = logicOf(doc).map((rule) => {
    let next = rule
    const expr = rewriteVars(rule.expr, oldRef, newRef)
    if (expr !== rule.expr) next = { ...next, expr }
    if (rule.kind === 'calculation' && rule.action?.variable === oldRef) {
      next = { ...next, action: { ...next.action, variable: newRef } }
    }
    return next
  })
  const blocks = doc.blocks.map((b) => ({
    ...b,
    title: rewriteTokens(b.title, oldRef, newRef) ?? b.title,
    description: rewriteTokens(b.description, oldRef, newRef),
  }))
  return { ...doc, logic, blocks }
}

/** Deep-clones the rules a block owns onto its duplicate (fresh ids, self-refs rewritten). */
export function cloneBlockRules(doc: FormDefinition, source: Block, clone: Block): FormDefinition {
  const cloned: Rule[] = []
  let visibilityId: string | undefined
  for (const rule of logicOf(doc)) {
    if (rule.owner?.ref !== source.id) continue
    const copy: Rule = {
      ...structuredClone(rule),
      id: newRuleId(),
      owner: { type: 'block', ref: clone.id },
      expr: rewriteVars(structuredClone(rule.expr), source.ref, clone.ref),
    }
    if (rule.id === source.visibility) visibilityId = copy.id
    cloned.push(copy)
  }
  return {
    ...doc,
    logic: [...logicOf(doc), ...cloned],
    blocks: doc.blocks.map((b) => (b.id === clone.id ? { ...b, visibility: visibilityId } : b)),
  }
}

/* ---------- form-level: variables & hidden fields ---------- */

export function setVariablesCascade(doc: FormDefinition, next: Variable[]): FormDefinition {
  const kept = new Set(next.map((v) => v.name))
  let out: FormDefinition = { ...doc, variables: next }
  for (const variable of doc.variables ?? []) {
    if (!kept.has(variable.name)) out = pruneName(out, variable.name)
  }
  return { ...out, variables: next }
}

export function setHiddenFieldsCascade(doc: FormDefinition, names: string[]): FormDefinition {
  const kept = new Set(names)
  let out: FormDefinition = { ...doc, settings: { ...doc.settings, hiddenFields: names } }
  for (const name of doc.settings?.hiddenFields ?? []) {
    if (!kept.has(name)) out = pruneName(out, name)
  }
  return { ...out, settings: { ...out.settings, hiddenFields: names } }
}
