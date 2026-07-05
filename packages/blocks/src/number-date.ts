// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { isoDateField, placeholderField } from './shared'
import type { BlockDefinition } from './types'
import { dateAnswer, numberAnswer } from './validators'

const numberProperties = z
  .strictObject({
    placeholder: placeholderField,
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    step: z.number().positive().finite().optional(),
  })
  .superRefine((props, ctx) => {
    if (props.min !== undefined && props.max !== undefined && props.min > props.max) {
      ctx.addIssue({
        code: 'custom',
        message: 'min must be less than or equal to max',
        path: ['min'],
      })
    }
  })

const dateProperties = z
  .strictObject({
    min: isoDateField.optional(),
    max: isoDateField.optional(),
  })
  .superRefine((props, ctx) => {
    // ISO dates compare correctly as strings.
    if (props.min !== undefined && props.max !== undefined && props.min > props.max) {
      ctx.addIssue({ code: 'custom', message: 'min must be on or before max', path: ['min'] })
    }
  })

export type NumberProperties = z.infer<typeof numberProperties>
export type DateProperties = z.infer<typeof dateProperties>

export const numberBlock: BlockDefinition = {
  type: 'number',
  category: 'number',
  displayName: 'Number',
  description: 'Collect a numeric answer, optionally bounded and stepped.',
  iconKey: 'number',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: numberProperties,
  validate: numberAnswer,
}

export const dateBlock: BlockDefinition = {
  type: 'date',
  category: 'number',
  displayName: 'Date',
  description: 'Collect a calendar date, optionally within bounds.',
  iconKey: 'date',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: dateProperties,
  validate: dateAnswer,
}
