// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { placeholderField } from './shared'
import type { BlockDefinition } from './types'
import { emailAnswer, phoneAnswer, websiteAnswer } from './validators'

const contactProperties = z.strictObject({
  placeholder: placeholderField,
})

export type EmailProperties = z.infer<typeof contactProperties>
export type PhoneProperties = z.infer<typeof contactProperties>
export type WebsiteProperties = z.infer<typeof contactProperties>

export const email: BlockDefinition = {
  type: 'email',
  category: 'contact',
  displayName: 'Email',
  description: 'Collect a valid email address.',
  iconKey: 'contact-email',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: contactProperties,
  validate: emailAnswer,
}

export const phone: BlockDefinition = {
  type: 'phone',
  category: 'contact',
  displayName: 'Phone number',
  description: 'Collect a phone number with basic validation.',
  iconKey: 'contact-phone',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: contactProperties,
  validate: phoneAnswer,
}

export const website: BlockDefinition = {
  type: 'website',
  category: 'contact',
  displayName: 'Website',
  description: 'Collect a link, validated as an http(s) URL.',
  iconKey: 'contact-website',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: contactProperties,
  validate: websiteAnswer,
}
