// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * LSDE engagement scoring — the AURA rubric (Length, Self-disclosure,
 * Emotion, Specificity) as honest heuristics. v1 deliberately uses no model
 * call here: scoring is free, instant, and deterministic; AURA's RL policy
 * is the v2 reference.
 */

export interface EngagementScore {
  length: number
  disclosure: number
  emotion: number
  specificity: number
  /** Weighted aggregate, 0–1. */
  engagement: number
}

const DISCLOSURE_RE = /\b(i|i'm|i've|i'd|me|my|mine|myself|we|our|us)\b/gi
const EMOTION_RE =
  /\b(love|loved|hate|hated|great|terrible|amazing|awful|excit\w*|frustrat\w*|worri\w*|happy|sad|angry|annoy\w*|delight\w*|disappoint\w*|afraid|scared|proud|enjoy\w*|struggl\w*|painful|fantastic|horrible|wonderful|stress\w*)\b/gi
const SPECIFICITY_RE =
  /\b(\d+[\w%]*|because|when|after|before|during|yesterday|today|last\s+\w+|every\s+\w+|specifically|example|instance)\b/gi

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export function scoreAnswer(text: string): EngagementScore {
  const trimmed = text.trim()
  const words = trimmed === '' ? [] : trimmed.split(/\s+/)
  const wordCount = words.length

  const length = clamp01(wordCount / 30)
  const disclosure = clamp01(
    ((trimmed.match(DISCLOSURE_RE) ?? []).length / Math.max(wordCount, 1)) * 5,
  )
  const emotion = clamp01((trimmed.match(EMOTION_RE) ?? []).length / 2)
  const specificity = clamp01((trimmed.match(SPECIFICITY_RE) ?? []).length / 3)

  const engagement = clamp01(0.3 * length + 0.2 * disclosure + 0.2 * emotion + 0.3 * specificity)
  return { length, disclosure, emotion, specificity, engagement }
}

/** Probe engaged respondents; never badger disengaged ones. */
export function shouldProbe(score: EngagementScore, index: number, maxFollowups: number): boolean {
  if (index > maxFollowups) return false
  // one-word shrugs ("no", "fine") don't earn a probe
  return score.engagement >= 0.12
}

export type FollowupType = 'specification' | 'elaboration' | 'probe' | 'validation' | 'continuation'

/** Follow-up taxonomy by heuristic thresholds (AURA's types, v1 mapping). */
export function selectFollowupType(score: EngagementScore): FollowupType {
  if (score.emotion >= 0.5) return 'validation' // acknowledge the feeling, then dig
  if (score.length < 0.3 && score.specificity < 0.34) return 'specification' // short + vague → pin it down
  if (score.specificity >= 0.67) return 'probe' // concrete → ask why it matters
  if (score.length >= 0.8) return 'continuation' // rich answer → keep the thread going
  return 'elaboration'
}
