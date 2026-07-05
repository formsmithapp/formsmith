// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { type BlockRegistry, isEmptyValue } from './registry'
import type { Block, Validation, ValidationType } from './types'

const DEFAULT_REQUIRED_MESSAGE = 'This field is required.'

function customMessage(block: Block, type: ValidationType): string | undefined {
  const entry = block.validations?.find((v) => v.type === type)
  return typeof entry?.message === 'string' && entry.message !== '' ? entry.message : undefined
}

function lengthOf(value: unknown): number | null {
  if (typeof value === 'string') return value.length
  if (Array.isArray(value)) return value.length
  return null
}

function checkConstraint(validation: Validation, value: unknown): string | null {
  const limit = validation.value
  switch (validation.type) {
    case 'required':
      return null // presence is governed by Block.required; this entry only carries a message
    case 'min':
      if (typeof value === 'number' && typeof limit === 'number' && value < limit) {
        return `Value must be at least ${limit}.`
      }
      return null
    case 'max':
      if (typeof value === 'number' && typeof limit === 'number' && value > limit) {
        return `Value must be at most ${limit}.`
      }
      return null
    case 'minLength': {
      const length = lengthOf(value)
      if (length !== null && typeof limit === 'number' && length < limit) {
        return typeof value === 'string'
          ? `Please enter at least ${limit} characters.`
          : `Please select at least ${limit}.`
      }
      return null
    }
    case 'maxLength': {
      const length = lengthOf(value)
      if (length !== null && typeof limit === 'number' && length > limit) {
        return typeof value === 'string'
          ? `Please enter at most ${limit} characters.`
          : `Please select at most ${limit}.`
      }
      return null
    }
    case 'pattern':
      if (typeof value === 'string' && typeof limit === 'string') {
        // Compiles at parse time too — createEngine rejects invalid or oversized patterns.
        if (!new RegExp(limit, 'u').test(value)) return 'Please match the requested format.'
      }
      return null
    default:
      return null
  }
}

/**
 * Full validation for one block's value: required check, the type's intrinsic
 * validator, then the block's declared constraints (custom messages win).
 */
export function validateBlockValue(
  block: Block,
  value: unknown,
  registry: BlockRegistry,
): string[] {
  const def = registry.get(block.type)
  if (!def?.isAnswerable) return []

  if (isEmptyValue(value)) {
    if (!block.required) return []
    return [customMessage(block, 'required') ?? DEFAULT_REQUIRED_MESSAGE]
  }

  const intrinsic = def.validate?.(value, block) ?? []
  if (intrinsic.length > 0) return intrinsic

  const errors: string[] = []
  for (const validation of block.validations ?? []) {
    const failure = checkConstraint(validation, value)
    if (failure !== null) {
      errors.push(
        typeof validation.message === 'string' && validation.message !== ''
          ? validation.message
          : failure,
      )
    }
  }
  return errors
}
