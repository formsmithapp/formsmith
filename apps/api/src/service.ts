// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { validateBlockProperties } from '@formsmithapp/blocks'
import {
  createEngine,
  type FormDefinition,
  FormValidationError,
  type SubmissionEvaluator,
  type SubmissionIssue,
} from '@formsmithapp/engine'

/**
 * The business rules the persistence layer deliberately doesn't have.
 * Client-for-UX, server-for-truth applies to validation too: the web app
 * runs the same two isomorphic checks for instant feedback; THIS copy is
 * the one that gates writes.
 */

/** The publish gate: engine parse + per-block property schemas. */
export function validateFormDocument(doc: FormDefinition): string[] {
  const issues: string[] = []
  try {
    createEngine(doc, { mode: 'edit' })
  } catch (error) {
    if (error instanceof FormValidationError) issues.push(...error.issues)
    else throw error
  }
  for (const block of doc.blocks) {
    const result = validateBlockProperties(block.type, block.properties ?? {})
    if (!result.ok) issues.push(...result.issues.map((issue) => `${block.ref}: ${issue}`))
  }
  return issues
}

export interface SubmitOutcome {
  ok: boolean
  issues: SubmissionIssue[]
  answers: Record<string, unknown>
  variables: Record<string, unknown>
  ending: string | null
}

/** The trust boundary — recompute everything, trust nothing (v1 §12 #6).
 * Takes a compiled evaluator so hosts can reuse one per (form, version) —
 * snapshot compilation dominates per-submission CPU. */
export function evaluateWith(
  evaluator: SubmissionEvaluator,
  payload: {
    answers: Record<string, unknown>
    variables?: Record<string, unknown>
    hiddenFields?: Record<string, string>
  },
): SubmitOutcome {
  const result = evaluator({
    answers: payload.answers,
    variables: payload.variables,
    hiddenFields: payload.hiddenFields,
  })
  return {
    ok: result.ok,
    issues: result.issues,
    answers: result.answers,
    variables: result.variables,
    ending: result.ending,
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Path params reach Postgres uuid columns — garbage must 404, not 500. */
export const isUuid = (value: string): boolean => UUID_RE.test(value)
