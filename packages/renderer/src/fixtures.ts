// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormDefinition } from '@formsmithapp/engine'

/** Welcome → name → email → ending, for flow/error/a11y tests. */
export const linearForm = (): FormDefinition => ({
  id: 'r_linear',
  version: 1,
  blocks: [
    {
      id: 'b_welcome',
      ref: 'intro',
      type: 'welcome',
      title: 'Hi there!',
      description: 'This takes one minute.',
    },
    { id: 'b_name', ref: 'name', type: 'short_text', title: 'What is your name?', required: true },
    {
      id: 'b_email',
      ref: 'email',
      type: 'email',
      title: 'And your email, {{name}}?',
      required: true,
    },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Thanks, {{name}}!' },
  ],
})

/** The scored quiz — piped score branches to pass/fail endings. */
export const quizForm = (): FormDefinition => ({
  id: 'r_quiz',
  version: 1,
  blocks: [
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
    { id: 'b_pass', ref: 'ending_pass', type: 'thankyou', title: 'Great — {{score}} points!' },
  ],
  variables: [{ name: 'score', type: 'number', initialValue: 0 }],
  logic: [
    {
      id: 'c_q1',
      kind: 'calculation',
      expr: { '==': [{ var: 'q1' }, 'four'] },
      action: { variable: 'score', op: 'add', value: 10 },
    },
  ],
})

/** Every v1 block type once — the keyboard-only completion fixture. */
export const kitchenSink = (): FormDefinition => ({
  id: 'r_sink',
  version: 1,
  settings: { hiddenFields: ['visitor'] },
  blocks: [
    { id: 'b_welcome', ref: 'intro', type: 'welcome', title: 'Welcome {{visitor}}' },
    { id: 'b_name', ref: 'name', type: 'short_text', title: 'Name?', required: true },
    { id: 'b_email', ref: 'email', type: 'email', title: 'Email?', required: true },
    { id: 'b_bio', ref: 'bio', type: 'long_text', title: 'Tell us more' },
    { id: 'b_age', ref: 'age', type: 'number', title: 'Age?', properties: { min: 0, max: 130 } },
    { id: 'b_birthday', ref: 'birthday', type: 'date', title: 'Birthday?' },
    {
      id: 'b_color',
      ref: 'color',
      type: 'dropdown',
      title: 'Favorite color?',
      properties: {
        choices: [
          { id: 'red', label: 'Red' },
          { id: 'blue', label: 'Blue' },
          { id: 'green', label: 'Green' },
        ],
      },
    },
    {
      id: 'b_plan',
      ref: 'plan',
      type: 'multiple_choice',
      title: 'Pick a plan',
      required: true,
      properties: {
        choices: [
          { id: 'basic', label: 'Basic' },
          { id: 'pro', label: 'Pro' },
        ],
      },
    },
    {
      id: 'b_pets',
      ref: 'pets',
      type: 'multiple_choice',
      title: 'Any pets?',
      properties: {
        multiple: true,
        choices: [
          { id: 'dog', label: 'Dog' },
          { id: 'cat', label: 'Cat' },
          { id: 'fish', label: 'Fish' },
        ],
      },
    },
    { id: 'b_confirm', ref: 'confirm', type: 'yes_no', title: 'Sure?', required: true },
    { id: 'b_terms', ref: 'terms', type: 'legal', title: 'Accept our terms?', required: true },
    {
      id: 'b_sat',
      ref: 'satisfaction',
      type: 'opinion_scale',
      title: 'How satisfied are you?',
      properties: { min: 1, max: 5, minLabel: 'Not at all', maxLabel: 'Very' },
    },
    { id: 'b_nps', ref: 'recommend', type: 'nps', title: 'Would you recommend us?' },
    {
      id: 'b_ai',
      ref: 'followup',
      type: 'ai_followup',
      title: 'Why that rating?',
      properties: { goal: 'probe rating', maxFollowups: 1, fallbackQuestion: 'Why that rating?' },
    },
    { id: 'b_note', ref: 'note', type: 'statement', title: 'Almost done, {{name}}.' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Done, {{name}}!' },
  ],
})
