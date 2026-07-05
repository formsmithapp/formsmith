// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { validateBlockProperties } from '@formsmithapp/blocks'
import { createEngine, type FormDefinition, FormValidationError } from '@formsmithapp/engine'

/**
 * The publish gate: the engine's structural/rule validation plus every
 * block's property schema. Drafts may be invalid while editing; published
 * snapshots never are.
 */
export function validateForm(form: FormDefinition): string[] {
  const issues: string[] = []
  try {
    createEngine(form, { mode: 'edit' })
  } catch (error) {
    if (error instanceof FormValidationError) issues.push(...error.issues)
    else throw error
  }
  for (const block of form.blocks ?? []) {
    const result = validateBlockProperties(block.type, block.properties ?? {})
    if (!result.ok) {
      issues.push(...result.issues.map((issue) => `block "${block.ref}": ${issue}`))
    }
  }
  return issues
}
