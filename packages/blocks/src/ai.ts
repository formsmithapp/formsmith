// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { textAnswer } from './shared'
import type { BlockDefinition } from './types'

/**
 * The AI Follow-up block's config (the `AIConfig` contract): what the
 * interviewer is probing for, a hard cap on generated follow-ups, and the
 * static question used whenever generation fails, times out, or is
 * disabled — the fallback is REQUIRED so the form never breaks without AI.
 */
const aiFollowupProperties = z.strictObject({
  goal: z.string().min(1).max(500),
  maxFollowups: z.number().int().min(1).max(5).default(1),
  fallbackQuestion: z.string().min(1).max(500),
})

export type AiFollowupProperties = z.infer<typeof aiFollowupProperties>

export const aiFollowup: BlockDefinition = {
  type: 'ai_followup',
  category: 'ai',
  displayName: 'AI Follow-up',
  description: 'Asks an adaptive follow-up question based on earlier answers.',
  iconKey: 'ai-followup',
  isAnswerable: true,
  // Deliberately fails its own schema: goal and fallbackQuestion must be
  // authored before the form is publishable. The only type defaulted invalid.
  defaultProperties: { goal: '', maxFollowups: 1, fallbackQuestion: '' },
  propertySchema: aiFollowupProperties,
  validate: textAnswer,
}
