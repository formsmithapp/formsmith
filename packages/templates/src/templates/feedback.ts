// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TemplateDefinition } from '../types'

/** NPS with visibility-branched follow-ups (detractors vs promoters). */
export const customerFeedback: TemplateDefinition = {
  id: 'customer-feedback',
  name: 'Customer feedback',
  description: 'NPS with follow-ups that adapt to the score.',
  accent: '#1e5e51',
  document: {
    id: 'template',
    title: 'Customer feedback',
    blocks: [
      {
        id: 'b_welcome',
        ref: 'welcome',
        type: 'welcome',
        title: 'How did we do?',
        description: "Two minutes, honest answers — that's all we ask.",
        required: false,
        properties: { buttonText: 'Start' },
      },
      {
        id: 'b_nps',
        ref: 'nps',
        type: 'nps',
        title: 'How likely are you to recommend us to a friend?',
        required: true,
        properties: { minLabel: 'Not at all likely', maxLabel: 'Extremely likely' },
      },
      {
        id: 'b_improve',
        ref: 'improve',
        type: 'long_text',
        title: 'What could we do better?',
        required: false,
        visibility: 'r_vis_improve',
        properties: {},
      },
      {
        id: 'b_highlight',
        ref: 'highlight',
        type: 'long_text',
        title: 'What did you love?',
        required: false,
        visibility: 'r_vis_highlight',
        properties: {},
      },
      {
        id: 'b_end',
        ref: 'thanks',
        type: 'thankyou',
        title: 'Thanks — every answer gets read.',
        required: false,
        properties: {},
      },
    ],
    logic: [
      {
        id: 'r_vis_improve',
        kind: 'visibility',
        owner: { type: 'block', ref: 'b_improve' },
        expr: { and: [{ '<=': [{ var: 'nps' }, 6] }] },
      },
      {
        id: 'r_vis_highlight',
        kind: 'visibility',
        owner: { type: 'block', ref: 'b_highlight' },
        expr: { and: [{ '>=': [{ var: 'nps' }, 9] }] },
      },
    ],
    variables: [],
    settings: {},
    theme: { brandColor: '#1e5e51', appearance: 'auto', fontPair: 'editorial' },
  },
}
