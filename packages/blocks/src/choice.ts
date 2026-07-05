// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { choiceIds, choicesField, placeholderField } from './shared'
import type { BlockDefinition, BlockLike } from './types'

const multipleChoiceProperties = z.strictObject({
  choices: choicesField,
  multiple: z.boolean().default(false),
})

const dropdownProperties = z.strictObject({
  choices: choicesField,
  placeholder: placeholderField,
})

const emptyProperties = z.strictObject({})

export type MultipleChoiceProperties = z.infer<typeof multipleChoiceProperties>
export type DropdownProperties = z.infer<typeof dropdownProperties>
export type YesNoProperties = z.infer<typeof emptyProperties>
export type LegalProperties = z.infer<typeof emptyProperties>

function multipleChoiceAnswer(value: unknown, block: BlockLike): string[] {
  const ids = choiceIds(block)
  if (block.properties?.multiple === true) {
    if (!Array.isArray(value)) return ['Please select from the available choices.']
    const seen = new Set<string>()
    for (const item of value) {
      if (typeof item !== 'string' || !ids.has(item) || seen.has(item)) {
        return ['Please select from the available choices.']
      }
      seen.add(item)
    }
    return []
  }
  return typeof value === 'string' && ids.has(value) ? [] : ['Please select a valid choice.']
}

function singleChoiceAnswer(value: unknown, block: BlockLike): string[] {
  return typeof value === 'string' && choiceIds(block).has(value)
    ? []
    : ['Please select a valid choice.']
}

const defaultChoices = () => [
  { id: 'choice-1', label: 'Choice 1' },
  { id: 'choice-2', label: 'Choice 2' },
]

export const multipleChoice: BlockDefinition = {
  type: 'multiple_choice',
  category: 'choice',
  displayName: 'Multiple choice',
  description: 'Pick one — or several — from a list of choices.',
  iconKey: 'choice-multiple',
  isAnswerable: true,
  defaultProperties: { choices: defaultChoices(), multiple: false },
  propertySchema: multipleChoiceProperties,
  validate: multipleChoiceAnswer,
}

export const dropdown: BlockDefinition = {
  type: 'dropdown',
  category: 'choice',
  displayName: 'Dropdown',
  description: 'Pick one option from a compact list.',
  iconKey: 'choice-dropdown',
  isAnswerable: true,
  defaultProperties: { choices: defaultChoices() },
  propertySchema: dropdownProperties,
  validate: singleChoiceAnswer,
}

export const yesNo: BlockDefinition = {
  type: 'yes_no',
  category: 'choice',
  displayName: 'Yes / No',
  description: 'A simple yes-or-no decision.',
  iconKey: 'choice-yes-no',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: emptyProperties,
  validate: (value) => (typeof value === 'boolean' ? [] : ['Please select yes or no.']),
}

export const legal: BlockDefinition = {
  type: 'legal',
  category: 'choice',
  displayName: 'Legal',
  description: 'Ask for explicit consent — accept or decline.',
  iconKey: 'choice-legal',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: emptyProperties,
  validate: (value, block) => {
    if (typeof value !== 'boolean') return ['Please choose whether you accept.']
    if (block.required && value !== true) return ['Please accept to continue.']
    return []
  },
}
