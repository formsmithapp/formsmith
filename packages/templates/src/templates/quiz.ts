// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TemplateDefinition } from '../types'

/** Scored quiz — calculated variable, score-branched endings, piped result. */
export const scoredQuiz: TemplateDefinition = {
  id: 'scored-quiz',
  name: 'Scored quiz',
  description: 'Points per answer, endings branched on the score.',
  accent: '#7048e8',
  document: {
    id: 'template',
    title: 'Pop quiz',
    blocks: [
      {
        id: 'b_welcome',
        ref: 'welcome',
        type: 'welcome',
        title: 'The pop quiz',
        description: 'Three questions, ten points each. No pressure.',
        required: false,
        properties: { buttonText: 'Begin' },
      },
      {
        id: 'b_q1',
        ref: 'q1',
        type: 'multiple_choice',
        title: 'What is 2 + 2?',
        required: true,
        properties: {
          choices: [
            { id: 'three', label: '3' },
            { id: 'four', label: '4' },
          ],
        },
      },
      {
        id: 'b_q2',
        ref: 'q2',
        type: 'multiple_choice',
        title: 'Capital of France?',
        required: true,
        properties: {
          choices: [
            { id: 'london', label: 'London' },
            { id: 'paris', label: 'Paris' },
          ],
        },
      },
      {
        id: 'b_q3',
        ref: 'q3',
        type: 'multiple_choice',
        title: 'Closest planet to the sun?',
        required: true,
        properties: {
          choices: [
            { id: 'venus', label: 'Venus' },
            { id: 'mercury', label: 'Mercury' },
          ],
        },
      },
      {
        id: 'b_fail',
        ref: 'result_fail',
        type: 'thankyou',
        title: 'Only {{score}} points — rematch?',
        required: false,
        properties: {},
      },
      {
        id: 'b_pass',
        ref: 'result_pass',
        type: 'thankyou',
        title: '{{score}} points — you passed!',
        required: false,
        properties: {},
      },
    ],
    logic: [
      {
        id: 'r_s1',
        kind: 'calculation',
        owner: { type: 'block', ref: 'b_q1' },
        expr: { and: [{ '==': [{ var: 'q1' }, 'four'] }] },
        action: { variable: 'score', op: 'add', value: 10 },
      },
      {
        id: 'r_s2',
        kind: 'calculation',
        owner: { type: 'block', ref: 'b_q2' },
        expr: { and: [{ '==': [{ var: 'q2' }, 'paris'] }] },
        action: { variable: 'score', op: 'add', value: 10 },
      },
      {
        id: 'r_s3',
        kind: 'calculation',
        owner: { type: 'block', ref: 'b_q3' },
        expr: { and: [{ '==': [{ var: 'q3' }, 'mercury'] }] },
        action: { variable: 'score', op: 'add', value: 10 },
      },
      {
        id: 'r_jump_pass',
        kind: 'jump',
        owner: { type: 'block', ref: 'b_q3' },
        expr: { and: [{ '>=': [{ var: 'score' }, 20] }] },
        action: { target: 'b_pass' },
      },
    ],
    variables: [{ name: 'score', type: 'number', initialValue: 0 }],
    settings: {},
    theme: { brandColor: '#7048e8', appearance: 'dark', fontPair: 'editorial' },
  },
}
