// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Guardrails (architecture §5.3 — all mandatory). Respondent answers are
 * UNTRUSTED prompt input; generated questions are UNTRUSTED output. Anything
 * that fails here falls back — never errors at the respondent.
 */

const MAX_ANSWER_CHARS = 2_000
const MAX_QUESTION_CHARS = 300

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Neutralize an answer before it enters a prompt: cap, strip control chars. */
export function sanitizeAnswer(text: string): string {
  return text.replace(CONTROL_CHARS, ' ').slice(0, MAX_ANSWER_CHARS).trim()
}

const OUTPUT_BLOCKLIST =
  /(system prompt|api[_ ]?key|ignore (all|previous|the) instructions|as an ai|<\/?script)/i

/**
 * Validates a generated question before it reaches a respondent.
 * Returns null when acceptable, else the rejection reason (→ fallback).
 */
export function validateQuestion(question: string): string | null {
  const trimmed = question.trim()
  if (trimmed.length === 0) return 'empty'
  if (trimmed.length > MAX_QUESTION_CHARS) return 'too_long'
  if (!/[a-z]/i.test(trimmed)) return 'no_text'
  if (!trimmed.includes('?')) return 'not_a_question'
  if (trimmed.includes('\n\n')) return 'multi_block'
  if (OUTPUT_BLOCKLIST.test(trimmed)) return 'blocklist'
  return null
}
