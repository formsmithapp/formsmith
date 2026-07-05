// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TemplateDefinition } from '../types'

/** Contact capture with a jump-to-ending for enterprise-sized teams. */
export const leadCapture: TemplateDefinition = {
  id: 'lead-capture',
  name: 'Lead capture',
  description: 'Name, email, team size — big teams jump to a personal follow-up.',
  accent: '#1d63d8',
  document: {
    id: 'template',
    title: 'Lead capture',
    blocks: [
      {
        id: 'b_welcome',
        ref: 'welcome',
        type: 'welcome',
        title: "Let's get you set up",
        description: 'Three quick questions and you are in.',
        required: false,
        properties: { buttonText: 'Get started' },
      },
      {
        id: 'b_name',
        ref: 'name',
        type: 'short_text',
        title: "What's your name?",
        required: true,
        properties: {},
      },
      {
        id: 'b_email',
        ref: 'email',
        type: 'email',
        title: 'Where can we reach you, {{name}}?',
        required: true,
        properties: {},
      },
      {
        id: 'b_team',
        ref: 'team_size',
        type: 'multiple_choice',
        title: 'How big is your team?',
        required: true,
        properties: {
          choices: [
            { id: 'solo', label: 'Just me' },
            { id: 'small', label: '2–10' },
            { id: 'mid', label: '11–50' },
            { id: 'large', label: '50+' },
          ],
        },
      },
      {
        id: 'b_end',
        ref: 'thanks',
        type: 'thankyou',
        title: 'Thanks, {{name}} — check your inbox.',
        required: false,
        properties: {},
      },
      {
        id: 'b_end_enterprise',
        ref: 'thanks_enterprise',
        type: 'thankyou',
        title: 'Thanks, {{name}} — our team will reach out personally today.',
        required: false,
        properties: {},
      },
    ],
    logic: [
      {
        id: 'r_jump_enterprise',
        kind: 'jump',
        owner: { type: 'block', ref: 'b_team' },
        expr: { and: [{ '==': [{ var: 'team_size' }, 'large'] }] },
        action: { target: 'b_end_enterprise' },
      },
    ],
    variables: [],
    settings: {},
    theme: { brandColor: '#1d63d8', appearance: 'auto', fontPair: 'editorial' },
  },
}
