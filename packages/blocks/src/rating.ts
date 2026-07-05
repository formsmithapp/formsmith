// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { integerInRange, labelField, numberProp } from './shared'
import type { BlockDefinition, BlockLike } from './types'

const opinionScaleProperties = z
  .strictObject({
    min: z.number().int().min(0).max(9).default(1),
    max: z.number().int().min(1).max(10).default(5),
    minLabel: labelField,
    maxLabel: labelField,
  })
  .superRefine((props, ctx) => {
    if (props.min >= props.max) {
      ctx.addIssue({ code: 'custom', message: 'min must be less than max', path: ['min'] })
    }
  })

const npsProperties = z.strictObject({
  minLabel: labelField,
  maxLabel: labelField,
})

export type OpinionScaleProperties = z.infer<typeof opinionScaleProperties>
export type NpsProperties = z.infer<typeof npsProperties>

function opinionScaleAnswer(value: unknown, block: BlockLike): string[] {
  const min = numberProp(block, 'min') ?? 1
  const max = numberProp(block, 'max') ?? 5
  return integerInRange(value, min, max)
}

export const opinionScale: BlockDefinition = {
  type: 'opinion_scale',
  category: 'rating',
  displayName: 'Opinion scale',
  description: 'A numbered scale, e.g. 1–5 or 0–10.',
  iconKey: 'rating-scale',
  isAnswerable: true,
  defaultProperties: { min: 1, max: 5 },
  propertySchema: opinionScaleProperties,
  validate: opinionScaleAnswer,
}

export const nps: BlockDefinition = {
  type: 'nps',
  category: 'rating',
  displayName: 'Net Promoter Score®',
  description: 'The standard 0–10 likelihood-to-recommend scale.',
  iconKey: 'rating-nps',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: npsProperties,
  validate: (value) => integerInRange(value, 0, 10),
}
