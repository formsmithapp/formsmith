// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import type { BlockDefinition } from './types'

const welcomeProperties = z.strictObject({
  buttonText: z.string().min(1).max(100).default('Start'),
})

const statementProperties = z.strictObject({
  buttonText: z.string().min(1).max(100).default('Continue'),
})

const thankyouProperties = z.strictObject({
  /**
   * Per-ending redirect. Must be http(s) — `z.url()` alone accepts other
   * schemes (`javascript:` parses as a URL), so the protocol is checked
   * explicitly: redirects are an injection surface.
   */
  redirectUrl: z
    .url()
    .refine((url) => url.startsWith('https://') || url.startsWith('http://'), {
      message: 'redirect must be an http(s) URL',
    })
    .optional(),
})

export type WelcomeProperties = z.infer<typeof welcomeProperties>
export type StatementProperties = z.infer<typeof statementProperties>
export type ThankyouProperties = z.infer<typeof thankyouProperties>

export const welcome: BlockDefinition = {
  type: 'welcome',
  category: 'screen',
  displayName: 'Welcome screen',
  description: 'The opening screen — title, description, and a start button.',
  iconKey: 'screen-welcome',
  isAnswerable: false,
  defaultProperties: { buttonText: 'Start' },
  propertySchema: welcomeProperties,
}

export const statement: BlockDefinition = {
  type: 'statement',
  category: 'screen',
  displayName: 'Statement',
  description: 'A message between questions — no answer collected.',
  iconKey: 'screen-statement',
  isAnswerable: false,
  defaultProperties: { buttonText: 'Continue' },
  propertySchema: statementProperties,
}

export const thankyou: BlockDefinition = {
  type: 'thankyou',
  category: 'screen',
  displayName: 'Thank-you screen',
  description: 'An ending. Forms can branch to multiple endings, each with its own redirect.',
  iconKey: 'screen-thankyou',
  isAnswerable: false,
  defaultProperties: {},
  propertySchema: thankyouProperties,
}
