// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@formsmithapp/engine` — the framework-agnostic Formsmith form engine.
 *
 * A block-tree state machine with navigation (jump-to-target, jump-to-ending),
 * visibility rules, calculated fields/variables/scoring, answer piping (escaped
 * by default), validation orchestration, hidden-field prefill, serialize/hydrate,
 * and server-side re-evaluation of untrusted submissions. Runs identically in
 * the browser, Node, and edge runtimes.
 */

export {
  createEngine,
  type EngineOptions,
  extractHiddenFields,
  type FormEngine,
} from './engine'
export { EngineError, FormValidationError } from './errors'
export { DEFAULT_SUBMISSION_LIMITS } from './limits'
export {
  type BlockRegistry,
  type BlockTypeDef,
  createDefaultRegistry,
  isEmptyValue,
} from './registry'
export { type EvaluateOptions, evaluateSubmission } from './server'
export type { EngineStore } from './store'
export { escapeHtml, pipeText } from './text'
export type * from './types'
export { validateBlockValue } from './validation'
