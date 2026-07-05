// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TemplateDefinition } from '../types'

/** Contact + role + an AI interviewer follow-up, closed with explicit consent. */
export const candidateScreening: TemplateDefinition = {
  id: 'candidate-screening',
  name: 'Candidate screening',
  description: 'An AI interviewer probes the highlight project; consent on record.',
  accent: '#17211d',
  document: {
    id: 'template',
    title: 'Candidate screening',
    blocks: [
      {
        id: 'b_welcome',
        ref: 'welcome',
        type: 'welcome',
        title: 'Thanks for applying',
        description: 'A few questions before we talk — about three minutes.',
        required: false,
        properties: { buttonText: 'Start' },
      },
      {
        id: 'b_name',
        ref: 'name',
        type: 'short_text',
        title: 'Your full name',
        required: true,
        properties: {},
      },
      {
        id: 'b_email',
        ref: 'email',
        type: 'email',
        title: 'Best email to reach you',
        required: true,
        properties: {},
      },
      {
        id: 'b_phone',
        ref: 'phone',
        type: 'phone',
        title: 'Phone number (optional)',
        required: false,
        properties: {},
      },
      {
        id: 'b_role',
        ref: 'role',
        type: 'multiple_choice',
        title: 'Which role are you applying for?',
        required: true,
        properties: {
          choices: [
            { id: 'engineering', label: 'Engineering' },
            { id: 'design', label: 'Design' },
            { id: 'product', label: 'Product' },
          ],
        },
      },
      {
        id: 'b_experience',
        ref: 'experience',
        type: 'ai_followup',
        title: "Tell me about a project you're proud of.",
        required: true,
        properties: {
          goal: "Probe for the candidate's concrete personal contribution and the measurable impact of the project they describe. One focused follow-up at a time; warm and professional.",
          maxFollowups: 2,
          fallbackQuestion:
            'What was your specific role in that project, and what changed because of your work?',
        },
      },
      {
        id: 'b_consent',
        ref: 'consent',
        type: 'legal',
        title: 'I consent to my application data being processed for this hiring round.',
        required: true,
        properties: {},
      },
      {
        id: 'b_end',
        ref: 'thanks',
        type: 'thankyou',
        title: "Thanks, {{name}} — we'll be in touch within a week.",
        required: false,
        properties: {},
      },
    ],
    logic: [],
    variables: [],
    settings: {},
    theme: { brandColor: '#17211d', appearance: 'auto', fontPair: 'system' },
  },
}
