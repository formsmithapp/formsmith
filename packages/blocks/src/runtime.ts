// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@formsmithapp/blocks/runtime` — the respondent hot-path subset of the
 * block registry: is-answerable flags and answer validators, with ZERO Zod.
 *
 * Published forms already passed the property-schema gate at save time, so
 * the runtime never needs schemas; splitting them out keeps ~65 KB gz of Zod
 * off the ≤45 KB respondent bundle. The full definitions in the package root
 * compose these exact objects with their schemas — one source of truth.
 */

import {
  type BlockLike,
  dateAnswer,
  emailAnswer,
  legalAnswer,
  multipleChoiceAnswer,
  npsAnswer,
  numberAnswer,
  opinionScaleAnswer,
  phoneAnswer,
  singleChoiceAnswer,
  textAnswer,
  websiteAnswer,
  yesNoAnswer,
} from './validators'

/** The runtime block-type contract — structurally the engine's `BlockTypeDef`. */
export interface RuntimeBlockDefinition {
  type: string
  isAnswerable: boolean
  validate?: (value: unknown, block: BlockLike) => string[]
}

/** The 17 v1 types, hot-path fields only, in palette order. */
export const runtimeBlockDefinitions: readonly RuntimeBlockDefinition[] = Object.freeze([
  { type: 'short_text', isAnswerable: true, validate: textAnswer },
  { type: 'long_text', isAnswerable: true, validate: textAnswer },
  { type: 'multiple_choice', isAnswerable: true, validate: multipleChoiceAnswer },
  { type: 'dropdown', isAnswerable: true, validate: singleChoiceAnswer },
  { type: 'yes_no', isAnswerable: true, validate: yesNoAnswer },
  { type: 'legal', isAnswerable: true, validate: legalAnswer },
  { type: 'email', isAnswerable: true, validate: emailAnswer },
  { type: 'phone', isAnswerable: true, validate: phoneAnswer },
  { type: 'website', isAnswerable: true, validate: websiteAnswer },
  { type: 'number', isAnswerable: true, validate: numberAnswer },
  { type: 'date', isAnswerable: true, validate: dateAnswer },
  { type: 'opinion_scale', isAnswerable: true, validate: opinionScaleAnswer },
  { type: 'nps', isAnswerable: true, validate: npsAnswer },
  { type: 'welcome', isAnswerable: false },
  { type: 'statement', isAnswerable: false },
  { type: 'thankyou', isAnswerable: false },
  { type: 'ai_followup', isAnswerable: true, validate: textAnswer },
])

export { type BlockLike, MAX_TEXT_LENGTH } from './validators'
