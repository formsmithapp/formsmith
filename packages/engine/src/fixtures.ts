// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Fixture form definitions shared by every engine test. The whole suite runs
 * unchanged in Node and in a real browser — these fixtures are the common input.
 * Each factory returns a fresh object so tests can never contaminate each other.
 */

import type { FormDefinition } from './types'

/** Welcome → name → email → statement → rating → thank-you. */
export const linearForm = (): FormDefinition => ({
  id: 'form_linear',
  version: 1,
  title: 'Linear',
  blocks: [
    { id: 'b_welcome', ref: 'intro', type: 'welcome', title: 'Welcome!' },
    { id: 'b_name', ref: 'name', type: 'short_text', title: 'Your name?', required: true },
    { id: 'b_email', ref: 'email', type: 'email', title: 'Your email?', required: true },
    { id: 'b_note', ref: 'note', type: 'statement', title: 'Nice to meet you, {{name}}.' },
    {
      id: 'b_rating',
      ref: 'rating',
      type: 'opinion_scale',
      title: 'Rate us, {{name}}',
      properties: { min: 1, max: 5 },
    },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Thanks, {{name}}!' },
  ],
})

/** `pet_name` is only visible after answering yes to `have_pet`. */
export const visibilityForm = (): FormDefinition => ({
  id: 'form_visibility',
  version: 1,
  blocks: [
    { id: 'b_pet', ref: 'have_pet', type: 'yes_no', title: 'Do you have a pet?', required: true },
    {
      id: 'b_pet_name',
      ref: 'pet_name',
      type: 'short_text',
      title: 'What is your pet called?',
      required: true,
      visibility: 'v_pet',
    },
    {
      id: 'b_color',
      ref: 'fav_color',
      type: 'dropdown',
      title: 'Favorite color?',
      properties: {
        choices: [
          { id: 'red', label: 'Red' },
          { id: 'blue', label: 'Blue' },
        ],
      },
    },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Done!' },
  ],
  logic: [{ id: 'v_pet', kind: 'visibility', expr: { '==': [{ var: 'have_pet' }, true] } }],
})

/**
 * Branching: enterprise jumps straight to the ending (jump-to-ending), pro skips
 * the basic question, basic answers its question then jumps over the pro one.
 */
export const jumpForm = (): FormDefinition => ({
  id: 'form_jump',
  version: 1,
  blocks: [
    {
      id: 'b_plan',
      ref: 'plan',
      type: 'multiple_choice',
      title: 'Which plan?',
      required: true,
      properties: {
        choices: [
          { id: 'basic', label: 'Basic' },
          { id: 'pro', label: 'Pro' },
          { id: 'enterprise', label: 'Enterprise' },
        ],
      },
    },
    { id: 'b_basic_q', ref: 'basic_q', type: 'short_text', title: 'Basic question' },
    { id: 'b_pro_q', ref: 'pro_q', type: 'short_text', title: 'Pro question' },
    { id: 'b_final', ref: 'final_note', type: 'statement', title: 'Almost done.' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Bye!' },
  ],
  logic: [
    {
      id: 'j_enterprise',
      kind: 'jump',
      owner: { type: 'block', ref: 'b_plan' },
      expr: { '==': [{ var: 'plan' }, 'enterprise'] },
      action: { target: 'ending' },
    },
    {
      id: 'j_pro',
      kind: 'jump',
      owner: { type: 'block', ref: 'plan' },
      expr: { '==': [{ var: 'plan' }, 'pro'] },
      action: { target: 'pro_q' },
    },
    {
      id: 'j_basic_done',
      kind: 'jump',
      owner: { type: 'block', ref: 'basic_q' },
      expr: { '==': [{ var: 'plan' }, 'basic'] },
      action: { target: 'final_note' },
    },
  ],
})

/**
 * The v1 scored-quiz fixture: three questions add 10 points each, the score is
 * piped into copy, and the ending branches on the outcome.
 */
export const quizForm = (): FormDefinition => ({
  id: 'form_quiz',
  version: 3,
  title: 'Pop quiz',
  blocks: [
    { id: 'b_welcome', ref: 'intro', type: 'welcome', title: 'Pop quiz!' },
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
          { id: 'paris', label: 'Paris' },
          { id: 'london', label: 'London' },
        ],
      },
    },
    {
      id: 'b_q3',
      ref: 'q3',
      type: 'multiple_choice',
      title: 'The red planet?',
      required: true,
      properties: {
        choices: [
          { id: 'mars', label: 'Mars' },
          { id: 'venus', label: 'Venus' },
        ],
      },
    },
    { id: 'b_result', ref: 'result', type: 'statement', title: 'You scored {{score}} of 30.' },
    { id: 'b_pass', ref: 'ending_pass', type: 'thankyou', title: 'Great job — {{score}} points!' },
    { id: 'b_fail', ref: 'ending_fail', type: 'thankyou', title: 'Only {{score}}. Try again!' },
  ],
  variables: [{ name: 'score', type: 'number', initialValue: 0 }],
  logic: [
    {
      id: 'c_q1',
      kind: 'calculation',
      expr: { '==': [{ var: 'q1' }, 'four'] },
      action: { variable: 'score', op: 'add', value: 10 },
    },
    {
      id: 'c_q2',
      kind: 'calculation',
      expr: { '==': [{ var: 'q2' }, 'paris'] },
      action: { variable: 'score', op: 'add', value: 10 },
    },
    {
      id: 'c_q3',
      kind: 'calculation',
      expr: { '==': [{ var: 'q3' }, 'mars'] },
      action: { variable: 'score', op: 'add', value: 10 },
    },
    {
      id: 'j_pass',
      kind: 'jump',
      owner: { type: 'block', ref: 'result' },
      expr: { '>=': [{ var: 'score' }, 20] },
      action: { target: 'ending_pass' },
    },
    {
      id: 'j_fail',
      kind: 'jump',
      owner: { type: 'block', ref: 'result' },
      expr: { '<': [{ var: 'score' }, 20] },
      action: { target: 'ending_fail' },
    },
  ],
})

/** Calculated field with a JSONLogic value expression (`set` op). */
export const calcForm = (): FormDefinition => ({
  id: 'form_calc',
  version: 1,
  blocks: [
    { id: 'b_qty', ref: 'qty', type: 'number', title: 'Quantity?', required: true },
    { id: 'b_price', ref: 'price', type: 'number', title: 'Unit price?', required: true },
    { id: 'b_sum', ref: 'summary', type: 'statement', title: 'Total: {{total}}' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Ordered!' },
  ],
  variables: [{ name: 'total', type: 'number' }],
  logic: [
    {
      id: 'c_total',
      kind: 'calculation',
      expr: { '!!': [{ var: 'qty' }] },
      action: {
        variable: 'total',
        op: 'set',
        value: { '*': [{ var: 'qty' }, { var: 'price' }] },
      },
    },
  ],
})

/** Hidden fields drive piping and visibility; only declared names are accepted. */
export const hiddenForm = (): FormDefinition => ({
  id: 'form_hidden',
  version: 1,
  settings: { hiddenFields: ['utm_source', 'visitor'] },
  blocks: [
    { id: 'b_welcome', ref: 'intro', type: 'welcome', title: 'Hi {{visitor}}!' },
    {
      id: 'b_vip',
      ref: 'vip_q',
      type: 'short_text',
      title: 'VIP question',
      visibility: 'v_vip',
    },
    { id: 'b_q', ref: 'feedback', type: 'long_text', title: 'Any feedback?' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Thanks {{visitor}}' },
  ],
  logic: [{ id: 'v_vip', kind: 'visibility', expr: { '==': [{ var: 'utm_source' }, 'email'] } }],
})

/** Every answerable v1 block type with constraints and custom messages. */
export const validationForm = (): FormDefinition => ({
  id: 'form_validation',
  version: 1,
  blocks: [
    {
      id: 'b_username',
      ref: 'username',
      type: 'short_text',
      title: 'Username',
      required: true,
      validations: [
        { type: 'minLength', value: 3, message: 'Name too short!' },
        { type: 'maxLength', value: 10 },
        { type: 'pattern', value: '^[a-z]+$', message: 'Lowercase letters only.' },
      ],
    },
    {
      id: 'b_bio',
      ref: 'bio',
      type: 'long_text',
      title: 'Bio',
      validations: [{ type: 'maxLength', value: 20 }],
    },
    {
      id: 'b_email',
      ref: 'contact_email',
      type: 'email',
      title: 'Email',
      required: true,
      validations: [{ type: 'required', message: 'We need your email!' }],
    },
    { id: 'b_phone', ref: 'contact_phone', type: 'phone', title: 'Phone' },
    { id: 'b_site', ref: 'site', type: 'website', title: 'Website' },
    {
      id: 'b_age',
      ref: 'age',
      type: 'number',
      title: 'Age',
      validations: [
        { type: 'min', value: 18, message: 'Adults only.' },
        { type: 'max', value: 120 },
      ],
    },
    { id: 'b_birthday', ref: 'birthday', type: 'date', title: 'Birthday' },
    {
      id: 'b_satisfaction',
      ref: 'satisfaction',
      type: 'opinion_scale',
      title: 'Satisfied?',
      properties: { min: 0, max: 10 },
    },
    { id: 'b_recommend', ref: 'recommend', type: 'nps', title: 'Recommend us?' },
    {
      id: 'b_pets',
      ref: 'pets',
      type: 'multiple_choice',
      title: 'Pets?',
      properties: {
        multiple: true,
        choices: [
          { id: 'dog', label: 'Dog' },
          { id: 'cat', label: 'Cat' },
          { id: 'fish', label: 'Fish' },
        ],
      },
      validations: [{ type: 'maxLength', value: 2, message: 'Pick at most two.' }],
    },
    {
      id: 'b_plan',
      ref: 'plan_choice',
      type: 'dropdown',
      title: 'Plan',
      properties: {
        choices: [
          { id: 'a', label: 'A' },
          { id: 'b', label: 'B' },
        ],
      },
    },
    { id: 'b_agree', ref: 'agree', type: 'legal', title: 'Accept terms?', required: true },
    { id: 'b_confirm', ref: 'confirm', type: 'yes_no', title: 'Sure?', required: true },
    { id: 'b_ai', ref: 'followup', type: 'ai_followup', title: 'Tell me more' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'Done' },
  ],
})

/** Two blocks that always jump to each other — a navigation cycle. */
export const cycleForm = (): FormDefinition => ({
  id: 'form_cycle',
  version: 1,
  blocks: [
    { id: 'b_a', ref: 'a', type: 'short_text', title: 'A' },
    { id: 'b_b', ref: 'b', type: 'short_text', title: 'B' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'End' },
  ],
  logic: [
    {
      id: 'j_ab',
      kind: 'jump',
      owner: { type: 'block', ref: 'a' },
      expr: true,
      action: { target: 'b' },
    },
    {
      id: 'j_ba',
      kind: 'jump',
      owner: { type: 'block', ref: 'b' },
      expr: true,
      action: { target: 'a' },
    },
  ],
})
