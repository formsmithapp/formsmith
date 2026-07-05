// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { MAX_TEXT_LENGTH, placeholderField, textAnswer } from './shared'
import type { BlockDefinition } from './types'

const textProperties = z.strictObject({
  placeholder: placeholderField,
  maxLength: z.number().int().min(1).max(MAX_TEXT_LENGTH).optional(),
})

export type ShortTextProperties = z.infer<typeof textProperties>
export type LongTextProperties = z.infer<typeof textProperties>

export const shortText: BlockDefinition = {
  type: 'short_text',
  category: 'text',
  displayName: 'Short text',
  description: 'A single-line free-text answer.',
  iconKey: 'text-short',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: textProperties,
  validate: textAnswer,
}

export const longText: BlockDefinition = {
  type: 'long_text',
  category: 'text',
  displayName: 'Long text',
  description: 'A multi-line free-text answer.',
  iconKey: 'text-long',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: textProperties,
  validate: textAnswer,
}
