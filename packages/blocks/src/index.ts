// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * `@formsmithapp/blocks` — the Formsmith block-type registry.
 *
 * One `BlockDefinition` per block type: category, presentation metadata
 * (plain data — icon keys, not icons), is-answerable flag, default
 * properties, a Zod property schema (the single source of truth for the
 * block's builder-editable config), and intrinsic answer validation.
 * Consumed by the engine (validation), the builder (settings panel), and
 * the renderer (presentation). Data + Zod only; isomorphic.
 */

export { type AiFollowupProperties, aiFollowup } from './ai'
export {
  type DropdownProperties,
  dropdown,
  type LegalProperties,
  legal,
  type MultipleChoiceProperties,
  multipleChoice,
  type YesNoProperties,
  yesNo,
} from './choice'
export {
  type EmailProperties,
  email,
  type PhoneProperties,
  phone,
  type WebsiteProperties,
  website,
} from './contact'
export {
  type DateProperties,
  dateBlock,
  type NumberProperties,
  numberBlock,
} from './number-date'
export { type NpsProperties, nps, type OpinionScaleProperties, opinionScale } from './rating'
export {
  createBlockRegistry,
  getBlockDefinition,
  v1BlockDefinitions,
  validateBlockProperties,
} from './registry'
export { type RuntimeBlockDefinition, runtimeBlockDefinitions } from './runtime'
export {
  type StatementProperties,
  statement,
  type ThankyouProperties,
  thankyou,
  type WelcomeProperties,
  welcome,
} from './screens'
export { MAX_TEXT_LENGTH } from './shared'
export { type LongTextProperties, longText, type ShortTextProperties, shortText } from './text'
export type {
  BlockCategory,
  BlockDefinition,
  BlockLike,
  PropertyValidationResult,
} from './types'
