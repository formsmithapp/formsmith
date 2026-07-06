// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { computeVariables } from './compute'
import { DEFAULT_SUBMISSION_LIMITS } from './limits'
import { firstVisibleFrom, resolveNextId } from './navigation'
import { buildRuleData, isAnswerable, isEnding, type ParsedForm, parseForm } from './parse'
import { type BlockTypeDef, isEmptyValue } from './registry'
import type {
  EvaluationResult,
  FormDefinition,
  Submission,
  SubmissionIssue,
  SubmissionLimits,
} from './types'
import { validateBlockValue } from './validation'

export interface EvaluateOptions {
  registry?: Iterable<BlockTypeDef>
  limits?: SubmissionLimits
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** v1 answer values: JSON primitives or flat arrays of them. Anything else is rejected. */
function isSupportedShape(value: unknown): boolean {
  const primitive = (v: unknown) =>
    typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' || v === null
  if (primitive(value)) return true
  return Array.isArray(value) && value.every(primitive)
}

function valueEquals(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * Server-side re-evaluation of an untrusted client submission — client-for-UX,
 * server-for-truth. Recomputes every variable from scratch, then simulates the
 * navigation path with the same resolution code the client engine uses. Rejects:
 * unknown refs, answers to non-answerable or off-path blocks (`rule_bypass`),
 * missing required on-path answers (`required_skip`), oversize values, invalid
 * values, and client variables that disagree with the recomputation.
 */
export function evaluateSubmission(
  form: FormDefinition,
  submission: Submission,
  options: EvaluateOptions = {},
): EvaluationResult {
  return createSubmissionEvaluator(form, options)(submission)
}

/** A reusable evaluator over one parsed form — see {@link createSubmissionEvaluator}. */
export type SubmissionEvaluator = (submission: Submission) => EvaluationResult

/**
 * The separable compile step of {@link evaluateSubmission}: parsing the form
 * (including JSONLogic rule compilation) dominates per-submission CPU, and a
 * published snapshot is immutable per version — so hosts can compile once per
 * (form, version) and evaluate many times. The returned function is pure and
 * safe to share across requests.
 */
export function createSubmissionEvaluator(
  form: FormDefinition,
  options: EvaluateOptions = {},
): SubmissionEvaluator {
  const parsed: ParsedForm = parseForm(form, options.registry)
  const limits = { ...DEFAULT_SUBMISSION_LIMITS, ...options.limits }
  return (submission) => evaluateParsed(parsed, limits, submission)
}

function evaluateParsed(
  parsed: ParsedForm,
  limits: Required<SubmissionLimits>,
  submission: Submission,
): EvaluationResult {
  const issues: SubmissionIssue[] = []
  const reject = (issue: SubmissionIssue) => {
    issues.push(issue)
  }

  const fail = (): EvaluationResult => ({
    ok: false,
    issues,
    answers: {},
    variables: {},
    path: [],
    ending: null,
  })

  if (!isPlainObject(submission) || !isPlainObject(submission.answers)) {
    reject({ code: 'malformed', message: 'submission.answers must be an object' })
    return fail()
  }

  let json: string | undefined
  try {
    json = JSON.stringify(submission)
  } catch {
    json = undefined
  }
  if (json === undefined) {
    reject({ code: 'malformed', message: 'submission is not JSON-serializable' })
    return fail()
  }
  if (json.length > limits.maxTotalBytes) {
    reject({ code: 'oversize', message: `submission exceeds ${limits.maxTotalBytes} bytes` })
    return fail()
  }

  // Hidden fields: only declared names, only strings, bounded length.
  const hidden: Record<string, string> = {}
  if (submission.hiddenFields !== undefined && !isPlainObject(submission.hiddenFields)) {
    reject({ code: 'malformed', message: 'submission.hiddenFields must be an object' })
  } else {
    for (const [name, value] of Object.entries(submission.hiddenFields ?? {})) {
      if (!parsed.hiddenFieldNames.includes(name)) {
        reject({
          code: 'unknown_hidden_field',
          ref: name,
          message: `undeclared hidden field "${name}"`,
        })
      } else if (typeof value !== 'string') {
        reject({ code: 'malformed', ref: name, message: `hidden field "${name}" must be a string` })
      } else if (value.length > limits.maxHiddenLength) {
        reject({
          code: 'oversize',
          ref: name,
          message: `hidden field "${name}" exceeds ${limits.maxHiddenLength} characters`,
        })
      } else {
        hidden[name] = value
      }
    }
  }

  // Answers: known answerable refs, supported shapes, bounded sizes.
  const answers: Record<string, unknown> = {}
  for (const [ref, value] of Object.entries(submission.answers)) {
    const block = parsed.byRef.get(ref)
    if (block === undefined) {
      reject({ code: 'unknown_ref', ref, message: `unknown block ref "${ref}"` })
      continue
    }
    if (!isAnswerable(parsed.registry, block)) {
      reject({ code: 'not_answerable', ref, message: `block "${ref}" does not take answers` })
      continue
    }
    if (isEmptyValue(value)) continue
    if (!isSupportedShape(value)) {
      reject({ code: 'invalid_answer', ref, message: `unsupported answer shape for "${ref}"` })
      continue
    }
    if (typeof value === 'string' && value.length > limits.maxStringLength) {
      reject({
        code: 'oversize',
        ref,
        message: `answer "${ref}" exceeds ${limits.maxStringLength} characters`,
      })
      continue
    }
    if (Array.isArray(value)) {
      if (value.length > limits.maxArrayLength) {
        reject({
          code: 'oversize',
          ref,
          message: `answer "${ref}" exceeds ${limits.maxArrayLength} items`,
        })
        continue
      }
      if (value.some((item) => typeof item === 'string' && item.length > limits.maxStringLength)) {
        reject({
          code: 'oversize',
          ref,
          message: `an item of "${ref}" exceeds ${limits.maxStringLength} characters`,
        })
        continue
      }
    }
    answers[ref] = value
  }

  // Authoritative recomputation — client-sent variables are never used.
  const variables = computeVariables(parsed, answers, hidden)
  const data = buildRuleData(answers, variables, hidden)

  // Simulate navigation under the final answers with the client's exact resolution code.
  const path: string[] = []
  const visited = new Set<string>()
  let ending: string | null = null
  let cursor = firstVisibleFrom(parsed, 0, data)
  while (cursor !== null) {
    if (visited.has(cursor)) {
      reject({ code: 'cycle', message: 'jump logic cycles under the submitted answers' })
      break
    }
    visited.add(cursor)
    const block = parsed.byId.get(cursor)
    if (block === undefined) break
    if (isEnding(block)) {
      ending = block.ref
      break
    }
    if (isAnswerable(parsed.registry, block)) path.push(block.ref)
    cursor = resolveNextId(parsed, cursor, data)
  }

  // Required-skip and per-type validity for every answerable block on the path.
  for (const ref of path) {
    const block = parsed.byRef.get(ref)
    if (block === undefined) continue
    const value = answers[ref]
    if (isEmptyValue(value)) {
      if (block.required) {
        reject({ code: 'required_skip', ref, message: `required block "${ref}" was not answered` })
      }
      continue
    }
    for (const message of validateBlockValue(block, value, parsed.registry)) {
      reject({ code: 'invalid_answer', ref, message })
    }
  }

  // Rule bypass: answers for answerable blocks the navigation path never reaches.
  const onPath = new Set(path)
  for (const ref of Object.keys(answers)) {
    if (!onPath.has(ref)) {
      reject({
        code: 'rule_bypass',
        ref,
        message: `answer for "${ref}" is not reachable under the form's logic`,
      })
    }
  }

  // Client-computed variables must agree with the server's recomputation.
  if (submission.variables !== undefined) {
    if (!isPlainObject(submission.variables)) {
      reject({ code: 'malformed', message: 'submission.variables must be an object' })
    } else {
      for (const [name, value] of Object.entries(submission.variables)) {
        if (!(name in variables)) {
          reject({ code: 'unknown_ref', ref: name, message: `unknown variable "${name}"` })
        } else if (!valueEquals(variables[name], value)) {
          reject({
            code: 'variable_mismatch',
            ref: name,
            message: `variable "${name}" does not match the server-computed value`,
          })
        }
      }
    }
  }

  const canonical: Record<string, unknown> = {}
  for (const ref of path) {
    if (ref in answers) canonical[ref] = answers[ref]
  }

  return { ok: issues.length === 0, issues, answers: canonical, variables, path, ending }
}
