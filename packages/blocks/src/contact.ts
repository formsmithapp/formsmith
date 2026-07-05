// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { placeholderField } from './shared'
import type { BlockDefinition } from './types'

const contactProperties = z.strictObject({
  placeholder: placeholderField,
})

export type EmailProperties = z.infer<typeof contactProperties>
export type PhoneProperties = z.infer<typeof contactProperties>
export type WebsiteProperties = z.infer<typeof contactProperties>

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const email: BlockDefinition = {
  type: 'email',
  category: 'contact',
  displayName: 'Email',
  description: 'Collect a valid email address.',
  iconKey: 'contact-email',
  isAnswerable: true,
  defaultProperties: {},
  propertySchema: contactProperties,
  validate: (value) =>
    typeof value === 'string' && EMAIL_RE.test(value)
      ? []
      : ['Please enter a valid email address.'],
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
  validate: (value) => {
    if (typeof value === 'string' && /^\+?[0-9\s().-]+$/.test(value)) {
      const digits = value.replace(/\D/g, '')
      if (digits.length >= 5 && digits.length <= 15) return []
    }
    return ['Please enter a valid phone number.']
  },
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
  validate: (value) => {
    if (typeof value === 'string') {
      try {
        const url = new URL(value)
        if (url.protocol === 'http:' || url.protocol === 'https:') return []
      } catch {
        // falls through to the error below
      }
    }
    return ['Please enter a valid URL (including http:// or https://).']
  },
}
