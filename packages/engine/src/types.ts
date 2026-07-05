// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Engine execution mode: builder preview, respondent runtime, or server re-evaluation. */
export type Mode = 'edit' | 'runtime' | 'server'

/** The v1 block types. The registry is extensible, so unknown strings are tolerated in the type. */
export type BlockType =
  | 'short_text'
  | 'long_text'
  | 'multiple_choice'
  | 'dropdown'
  | 'yes_no'
  | 'legal'
  | 'email'
  | 'phone'
  | 'website'
  | 'number'
  | 'date'
  | 'opinion_scale'
  | 'nps'
  | 'welcome'
  | 'statement'
  | 'thankyou'
  | 'ai_followup'
  | (string & {})

export type ValidationType = 'required' | 'min' | 'max' | 'minLength' | 'maxLength' | 'pattern'

/**
 * A per-block validation constraint. `required` entries only customize the message —
 * the `Block.required` flag governs whether the check runs.
 */
export interface Validation {
  type: ValidationType
  value?: unknown
  message?: string
}

export interface Block {
  /** Stable internal id — the pointer rules and navigation use. */
  id: string
  /** Human slug for piping and answers, e.g. `first_name`. Dot-free. */
  ref: string
  type: BlockType
  title: string
  description?: string
  required?: boolean
  properties?: Record<string, unknown>
  validations?: Validation[]
  /** Rule id (into `FormDefinition.logic`) of a `visibility` rule. Truthy ⇒ shown. */
  visibility?: string
}

/** A JSONLogic AST. Untrusted — validated by `@formsmithapp/rules` before compilation. */
export type JsonLogic = unknown

export type RuleKind = 'visibility' | 'jump' | 'calculation' | 'trigger'

export interface RuleAction {
  /** Jump rules: target block id or ref (including endings — jump-to-ending). */
  target?: string
  /** Calculation rules: the variable to write. */
  variable?: string
  op?: 'set' | 'add'
  /** Literal value, or a JSONLogic AST when a plain (non-array) object. */
  value?: unknown
}

export interface Rule {
  id: string
  kind: RuleKind
  /** Jump rules attach to the block they fire from via `owner.ref` (block id or ref). */
  owner?: { type: 'block' | 'form'; ref?: string }
  expr: JsonLogic
  action?: RuleAction
}

export interface Variable {
  /** Dot-free slug, unique across block refs, variables, and hidden fields. */
  name: string
  type?: 'number' | 'string' | 'boolean'
  /** Defaults to `0` for `number` variables, `null` otherwise. */
  initialValue?: unknown
}

export interface FormSettings {
  /** Declared hidden-field names (URL prefill). Undeclared keys are never accepted. */
  hiddenFields?: string[]
}

/** The subset of the form document the engine consumes. Extra fields are ignored. */
export interface FormDefinition {
  id: string
  title?: string
  version?: number
  blocks: Block[]
  logic?: Rule[]
  variables?: Variable[]
  settings?: FormSettings
}

export type EngineStatus = 'in_progress' | 'complete'

/** The reactive store snapshot. Replaced wholesale on every change — safe to compare by identity. */
export interface EngineState {
  status: EngineStatus
  /** Current block id, or `null` when the form completed without an ending block. */
  currentId: string | null
  /** Answers keyed by block ref. */
  answers: Record<string, unknown>
  /** Computed variables keyed by name — always derived, never client-authored. */
  variables: Record<string, unknown>
  /** Accepted hidden-field values keyed by declared name. */
  hidden: Record<string, string>
  /** Validation messages by block ref — written by `next()`, cleared by `setAnswer()`. */
  errors: Record<string, string[]>
  /** Visited block ids, oldest first — powers `prev()` under jump logic. */
  history: string[]
}

/** JSON-safe snapshot produced by `engine.serialize()` and accepted by `engine.hydrate()`. */
export interface SerializedEngineState {
  v: 1
  formId: string
  formVersion?: number
  status: EngineStatus
  currentId: string | null
  answers: Record<string, unknown>
  /** Carried for inspection only — `hydrate()` always recomputes variables from answers. */
  variables: Record<string, unknown>
  hidden: Record<string, string>
  history: string[]
}

export interface Progress {
  /** Visible answerable blocks with a non-empty answer. */
  answered: number
  /** Visible answerable blocks in total. */
  total: number
  /** `answered / total`; degenerate forms report 0 until complete, then 1. */
  ratio: number
}

export interface NavResult {
  ok: boolean
  /** The current block after the call (unchanged when `ok` is false). */
  block: Block | null
  /** Validation messages when navigation was blocked by the current block. */
  errors?: string[]
}

export interface PipeOptions {
  /** HTML-escape interpolated values. Defaults to `true` — piping is an injection surface. */
  escape?: boolean
}

export interface EngineEvents {
  answer: { ref: string; value: unknown }
  navigate: { from: string | null; to: string | null }
  complete: { answers: Record<string, unknown>; variables: Record<string, unknown> }
}

/** A client submission as received by the server — entirely untrusted. */
export interface Submission {
  answers: Record<string, unknown>
  /** Client-computed variables. Never used — cross-checked against the server's recomputation. */
  variables?: Record<string, unknown>
  hiddenFields?: Record<string, string>
}

export type SubmissionIssueCode =
  | 'malformed'
  | 'unknown_ref'
  | 'not_answerable'
  | 'unknown_hidden_field'
  | 'oversize'
  | 'required_skip'
  | 'rule_bypass'
  | 'invalid_answer'
  | 'variable_mismatch'
  | 'cycle'

export interface SubmissionIssue {
  code: SubmissionIssueCode
  /** The offending block ref, variable, or hidden-field name where applicable. */
  ref?: string
  message: string
}

export interface SubmissionLimits {
  /** Max length of any string answer (and array elements). Default 10_000. */
  maxStringLength?: number
  /** Max element count of any array answer. Default 100. */
  maxArrayLength?: number
  /** Max length of a hidden-field value. Default 1_000. */
  maxHiddenLength?: number
  /** Max JSON size of the whole submission in UTF-16 code units. Default 262_144. */
  maxTotalBytes?: number
}

export interface EvaluationResult {
  ok: boolean
  issues: SubmissionIssue[]
  /** Canonical accepted answers — only blocks on the evaluated path. */
  answers: Record<string, unknown>
  /** Authoritative server-computed variables. */
  variables: Record<string, unknown>
  /** Refs of answerable blocks on the navigation path, in order. */
  path: string[]
  /** Ref of the ending block the path reaches, or `null`. */
  ending: string | null
}
