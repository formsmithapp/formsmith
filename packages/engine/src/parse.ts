// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type CompiledRule,
  collectRuleRefs,
  compileRule,
  RuleValidationError,
} from '@formsmithapp/rules'
import { FormValidationError } from './errors'
import { type BlockRegistry, type BlockTypeDef, createDefaultRegistry } from './registry'
import type { Block, FormDefinition, Rule, Validation, Variable } from './types'

/** Refs, variable names, and hidden-field names: dot-free slugs (dots delimit paths). */
const SLUG_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/

/** Reserved so namespaced piping tokens (`{{var.x}}`, `{{hidden.x}}`, …) stay possible later. */
const RESERVED_SLUGS = new Set(['var', 'block', 'field', 'hidden'])

const MAX_PATTERN_LENGTH = 200

const VALIDATION_TYPES = new Set(['required', 'min', 'max', 'minLength', 'maxLength', 'pattern'])

const RULE_KINDS = new Set(['visibility', 'jump', 'calculation', 'trigger'])

export interface CompiledJump {
  when: CompiledRule
  targetId: string
}

export interface CompiledCalculation {
  when: CompiledRule
  variable: string
  op: 'set' | 'add'
  /** Compiled JSONLogic when `action.value` was a plain object; otherwise `null`. */
  value: CompiledRule | null
  literal: unknown
}

export interface ParsedForm {
  form: FormDefinition
  blocks: readonly Block[]
  byId: ReadonlyMap<string, Block>
  byRef: ReadonlyMap<string, Block>
  indexById: ReadonlyMap<string, number>
  registry: BlockRegistry
  visibilityByBlockId: ReadonlyMap<string, CompiledRule>
  jumpsByBlockId: ReadonlyMap<string, CompiledJump[]>
  calculations: readonly CompiledCalculation[]
  variables: readonly Variable[]
  hiddenFieldNames: readonly string[]
  knownRefs: ReadonlySet<string>
}

export function resolveBlock(parsed: ParsedForm, idOrRef: string): Block | undefined {
  return parsed.byId.get(idOrRef) ?? parsed.byRef.get(idOrRef)
}

export function isEnding(block: Block): boolean {
  return block.type === 'thankyou'
}

export function isAnswerable(registry: BlockRegistry, block: Block): boolean {
  return registry.get(block.type)?.isAnswerable === true
}

/** JSONLogic truthiness — like JS, except an empty array is falsy. */
export function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

/** The flat rule/piping namespace: hidden fields, then answers by ref, then variables. */
export function buildRuleData(
  answers: Record<string, unknown>,
  variables: Record<string, unknown>,
  hidden: Record<string, string>,
): Record<string, unknown> {
  return { ...hidden, ...answers, ...variables }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function checkValidation(validation: Validation, where: string, issues: string[]): void {
  if (!VALIDATION_TYPES.has(validation.type)) {
    issues.push(`${where}: unknown validation type "${String(validation.type)}"`)
    return
  }
  const value = validation.value
  switch (validation.type) {
    case 'min':
    case 'max':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        issues.push(`${where}: "${validation.type}" needs a finite numeric value`)
      }
      break
    case 'minLength':
    case 'maxLength':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        issues.push(`${where}: "${validation.type}" needs a non-negative integer value`)
      }
      break
    case 'pattern':
      if (typeof value !== 'string' || value.length === 0) {
        issues.push(`${where}: "pattern" needs a regex source string`)
      } else if (value.length > MAX_PATTERN_LENGTH) {
        issues.push(`${where}: pattern exceeds ${MAX_PATTERN_LENGTH} characters`)
      } else {
        try {
          new RegExp(value, 'u')
        } catch {
          issues.push(`${where}: pattern does not compile`)
        }
      }
      break
    default:
      break
  }
}

/**
 * Validates and compiles an untrusted form definition. Structural problems and rule-AST
 * violations (unknown operators, depth/size bombs, unresolvable refs) are all collected
 * and thrown together as a `FormValidationError`. Nothing unvalidated is ever evaluated.
 */
export function parseForm(form: FormDefinition, extraTypes?: Iterable<BlockTypeDef>): ParsedForm {
  const issues: string[] = []
  const registry = createDefaultRegistry(extraTypes)

  if (!isPlainObject(form)) throw new FormValidationError(['form definition must be an object'])
  if (typeof form.id !== 'string' || form.id === '')
    issues.push('form.id must be a non-empty string')
  if (!Array.isArray(form.blocks)) {
    issues.push('form.blocks must be an array')
    throw new FormValidationError(issues)
  }

  const blocks: Block[] = []
  const byId = new Map<string, Block>()
  const byRef = new Map<string, Block>()
  const indexById = new Map<string, number>()

  form.blocks.forEach((block, position) => {
    const where = `blocks[${position}]`
    if (!isPlainObject(block)) {
      issues.push(`${where}: must be an object`)
      return
    }
    if (typeof block.id !== 'string' || block.id === '') {
      issues.push(`${where}: id must be a non-empty string`)
      return
    }
    if (byId.has(block.id)) {
      issues.push(`${where}: duplicate block id "${block.id}"`)
      return
    }
    if (typeof block.ref !== 'string' || !SLUG_RE.test(block.ref)) {
      issues.push(`${where}: ref must be a dot-free slug (got ${JSON.stringify(block.ref)})`)
      return
    }
    if (RESERVED_SLUGS.has(block.ref)) {
      issues.push(`${where}: ref "${block.ref}" is a reserved word`)
      return
    }
    if (byRef.has(block.ref)) {
      issues.push(`${where}: duplicate block ref "${block.ref}"`)
      return
    }
    if (!registry.has(block.type)) {
      issues.push(`${where}: unknown block type "${String(block.type)}"`)
      return
    }
    if (block.validations !== undefined) {
      if (!Array.isArray(block.validations)) {
        issues.push(`${where}: validations must be an array`)
        return
      }
      for (const validation of block.validations) {
        checkValidation(validation, `${where} (ref "${block.ref}")`, issues)
      }
    }
    indexById.set(block.id, blocks.length)
    blocks.push(block)
    byId.set(block.id, block)
    byRef.set(block.ref, block)
  })

  const knownRefs = new Set<string>(byRef.keys())

  const variables: Variable[] = []
  const variableNames = new Set<string>()
  for (const variable of form.variables ?? []) {
    if (!isPlainObject(variable) || typeof variable.name !== 'string') {
      issues.push('variables: each entry needs a string name')
      continue
    }
    if (!SLUG_RE.test(variable.name)) {
      issues.push(`variable "${variable.name}": name must be a dot-free slug`)
      continue
    }
    if (RESERVED_SLUGS.has(variable.name)) {
      issues.push(`variable "${variable.name}": name is a reserved word`)
      continue
    }
    if (knownRefs.has(variable.name)) {
      issues.push(`variable "${variable.name}": name collides with a block ref or variable`)
      continue
    }
    knownRefs.add(variable.name)
    variableNames.add(variable.name)
    variables.push(variable)
  }

  const hiddenFieldNames: string[] = []
  for (const name of form.settings?.hiddenFields ?? []) {
    if (typeof name !== 'string' || !SLUG_RE.test(name)) {
      issues.push(`hidden field ${JSON.stringify(name)}: must be a dot-free slug`)
      continue
    }
    if (RESERVED_SLUGS.has(name)) {
      issues.push(`hidden field "${name}": name is a reserved word`)
      continue
    }
    if (knownRefs.has(name)) {
      issues.push(`hidden field "${name}": name collides with a block ref or variable`)
      continue
    }
    knownRefs.add(name)
    hiddenFieldNames.push(name)
  }

  const compileOrCollect = (expr: unknown, where: string): CompiledRule | null => {
    try {
      return compileRule(expr, { knownRefs })
    } catch (error) {
      if (error instanceof RuleValidationError) {
        for (const issue of error.issues) issues.push(`${where}: ${issue}`)
        return null
      }
      throw error
    }
  }

  const ruleIds = new Set<string>()
  const visibilityRules = new Map<string, CompiledRule>()
  const visibilityRuleRefs = new Map<string, ReadonlySet<string>>()
  const rulesById = new Map<string, Rule>()
  const jumpsByBlockId = new Map<string, CompiledJump[]>()
  const calculations: CompiledCalculation[] = []

  /**
   * Visibility and jump conditions may only read *earlier* blocks. A forward
   * reference evaluates differently mid-session (unanswered ⇒ null) than in
   * the server's final-answers re-walk, which would falsely reject honest
   * respondents. Variables and hidden fields are exempt (variables recompute
   * order-independently; a variable built from later answers is a documented
   * v1 gap — no taint tracking). Returns block refs strictly after `boundary`.
   */
  const forwardBlockRefs = (expr: unknown, boundary: number): string[] => {
    const offenders: string[] = []
    for (const refName of collectRuleRefs(expr)) {
      const referenced = byRef.get(refName)
      if (referenced === undefined) continue
      if ((indexById.get(referenced.id) ?? 0) > boundary) offenders.push(refName)
    }
    return offenders
  }

  for (const rule of form.logic ?? []) {
    if (!isPlainObject(rule) || typeof rule.id !== 'string' || rule.id === '') {
      issues.push('logic: each rule needs a non-empty string id')
      continue
    }
    const where = `rule "${rule.id}"`
    if (ruleIds.has(rule.id)) {
      issues.push(`${where}: duplicate rule id`)
      continue
    }
    ruleIds.add(rule.id)
    if (!RULE_KINDS.has(rule.kind)) {
      issues.push(`${where}: unknown kind "${String(rule.kind)}"`)
      continue
    }
    const when = compileOrCollect(rule.expr, where)
    if (when === null) continue
    rulesById.set(rule.id, rule)

    if (rule.kind === 'visibility') {
      visibilityRules.set(rule.id, when)
      visibilityRuleRefs.set(rule.id, collectRuleRefs(rule.expr))
    } else if (rule.kind === 'jump') {
      const ownerRef = rule.owner?.ref
      const owner =
        typeof ownerRef === 'string' ? (byId.get(ownerRef) ?? byRef.get(ownerRef)) : undefined
      if (!owner) {
        issues.push(`${where}: jump owner must reference an existing block`)
        continue
      }
      const targetRef = rule.action?.target
      const target =
        typeof targetRef === 'string' ? (byId.get(targetRef) ?? byRef.get(targetRef)) : undefined
      if (!target) {
        issues.push(`${where}: jump target must reference an existing block`)
        continue
      }
      const ownerIndex = indexById.get(owner.id) ?? 0
      for (const offender of forwardBlockRefs(rule.expr, ownerIndex)) {
        issues.push(
          `${where}: jump condition references "${offender}", which comes after its block "${owner.ref}"`,
        )
      }
      const list = jumpsByBlockId.get(owner.id) ?? []
      list.push({ when, targetId: target.id })
      jumpsByBlockId.set(owner.id, list)
    } else if (rule.kind === 'calculation') {
      const variable = rule.action?.variable
      if (typeof variable !== 'string' || !variableNames.has(variable)) {
        issues.push(`${where}: calculation must target a declared variable`)
        continue
      }
      const op = rule.action?.op ?? 'set'
      if (op !== 'set' && op !== 'add') {
        issues.push(`${where}: calculation op must be "set" or "add"`)
        continue
      }
      const rawValue = rule.action?.value
      let value: CompiledRule | null = null
      if (isPlainObject(rawValue)) {
        value = compileOrCollect(rawValue, `${where} (value)`)
        if (value === null) continue
      }
      calculations.push({ when, variable, op, value, literal: rawValue })
    }
    // 'trigger' rules are validated and parsed but carry no v1 behavior.
  }

  const visibilityByBlockId = new Map<string, CompiledRule>()
  for (const block of blocks) {
    if (block.visibility === undefined) continue
    const compiled = visibilityRules.get(block.visibility)
    if (compiled === undefined) {
      const known = rulesById.has(block.visibility)
      issues.push(
        known
          ? `block "${block.ref}": visibility must reference a rule of kind "visibility"`
          : `block "${block.ref}": visibility references unknown rule "${block.visibility}"`,
      )
      continue
    }
    const blockIndex = indexById.get(block.id) ?? 0
    for (const refName of visibilityRuleRefs.get(block.visibility) ?? []) {
      const referenced = byRef.get(refName)
      if (referenced === undefined) continue
      const refIndex = indexById.get(referenced.id) ?? 0
      if (refIndex === blockIndex) {
        issues.push(
          `block "${block.ref}": visibility rule "${block.visibility}" references the block's own answer`,
        )
      } else if (refIndex > blockIndex) {
        issues.push(
          `block "${block.ref}": visibility rule "${block.visibility}" references "${refName}", which comes later in the form`,
        )
      }
    }
    visibilityByBlockId.set(block.id, compiled)
  }

  if (issues.length > 0) throw new FormValidationError(issues)

  return {
    form,
    blocks,
    byId,
    byRef,
    indexById,
    registry,
    visibilityByBlockId,
    jumpsByBlockId,
    calculations,
    variables,
    hiddenFieldNames,
    knownRefs,
  }
}
