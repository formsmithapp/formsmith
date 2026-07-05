// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/** Thrown on engine API misuse or state violations (unknown refs, terminal-state writes, …). */
export class EngineError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'EngineError'
    this.code = code
  }
}

/**
 * Thrown by `createEngine`/`evaluateSubmission` when a form definition fails validation.
 * Form definitions are untrusted input — every structural and rule-AST issue is collected.
 */
export class FormValidationError extends EngineError {
  readonly issues: readonly string[]

  constructor(issues: readonly string[]) {
    super('invalid_form', `Invalid form definition: ${issues.join('; ')}`)
    this.name = 'FormValidationError'
    this.issues = issues
  }
}
