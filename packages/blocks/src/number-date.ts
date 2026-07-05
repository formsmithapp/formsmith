// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { isoDateField, isRealDate, numberProp, placeholderField, stringProp } from './shared'
import type { BlockDefinition, BlockLike } from './types'

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

function numberAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ['Please enter a number.']
  const min = numberProp(block, 'min')
  const max = numberProp(block, 'max')
  const step = numberProp(block, 'step')
  if (min !== undefined && value < min) return [`Value must be at least ${min}.`]
  if (max !== undefined && value > max) return [`Value must be at most ${max}.`]
  if (step !== undefined && step > 0) {
    const ratio = (value - (min ?? 0)) / step
    if (Math.abs(ratio - Math.round(ratio)) > 1e-9) return [`Please use increments of ${step}.`]
  }
  return []
}

function dateAnswer(value: unknown, block: BlockLike): string[] {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !isRealDate(value)) {
    return ['Please enter a valid date (YYYY-MM-DD).']
  }
  const min = stringProp(block, 'min')
  const max = stringProp(block, 'max')
  if (min !== undefined && value < min) return [`Please pick a date on or after ${min}.`]
  if (max !== undefined && value > max) return [`Please pick a date on or before ${max}.`]
  return []
}

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
