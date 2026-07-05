// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TemplateDefinition } from '../types'

/** RSVP flow — the diet question only appears for in-person guests. */
export const eventRegistration: TemplateDefinition = {
  id: 'event-registration',
  name: 'Event registration',
  description: 'RSVP with conditional questions for in-person guests.',
  accent: '#c1841f',
  document: {
    id: 'template',
    title: 'Event registration',
    blocks: [
      {
        id: 'b_welcome',
        ref: 'welcome',
        type: 'welcome',
        title: "You're invited",
        description: 'Community meetup — one evening, good people, short talks.',
        required: false,
        properties: { buttonText: 'RSVP' },
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
        title: 'Best email for the calendar invite?',
        required: true,
        properties: {},
      },
      {
        id: 'b_person',
        ref: 'in_person',
        type: 'yes_no',
        title: 'Joining us in person?',
        required: true,
        properties: {},
      },
      {
        id: 'b_diet',
        ref: 'diet',
        type: 'multiple_choice',
        title: 'Any dietary preference?',
        required: false,
        visibility: 'r_vis_diet',
        properties: {
          choices: [
            { id: 'none', label: 'No preference' },
            { id: 'vegetarian', label: 'Vegetarian' },
            { id: 'vegan', label: 'Vegan' },
            { id: 'gluten_free', label: 'Gluten-free' },
          ],
        },
      },
      {
        id: 'b_end',
        ref: 'thanks',
        type: 'thankyou',
        title: 'See you there, {{name}}!',
        required: false,
        properties: {},
      },
    ],
    logic: [
      {
        id: 'r_vis_diet',
        kind: 'visibility',
        owner: { type: 'block', ref: 'b_diet' },
        expr: { and: [{ '==': [{ var: 'in_person' }, true] }] },
      },
    ],
    variables: [],
    settings: {},
    theme: { brandColor: '#c1841f', appearance: 'auto', fontPair: 'literary' },
  },
}
