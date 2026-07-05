// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { TemplateDefinition } from '../types'

/**
 * The flagship template — the form "a hospital can actually use": consent
 * before any data is collected, an AI clarify step that only gathers (never
 * diagnoses), and self-host framing in the respondent-facing copy.
 */
export const patientIntake: TemplateDefinition = {
  id: 'patient-intake',
  name: 'Patient intake / research screener',
  description: 'Consent-first intake with an AI clarify step. Data stays on your own server.',
  accent: '#0e7490',
  featured: true,
  document: {
    id: 'template',
    title: 'Patient intake',
    blocks: [
      {
        id: 'b_welcome',
        ref: 'welcome',
        type: 'welcome',
        title: 'Before your visit',
        description:
          "A few questions so the doctor can prepare. Your answers stay on this clinic's own server — they are never shared with third parties.",
        required: false,
        properties: { buttonText: 'Begin' },
      },
      {
        id: 'b_consent',
        ref: 'consent',
        type: 'legal',
        title: 'I consent to this clinic storing my answers to prepare for my visit.',
        description: 'You can ask for your data to be corrected or deleted at any time.',
        required: true,
        properties: {},
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
        id: 'b_dob',
        ref: 'date_of_birth',
        type: 'date',
        title: 'Your date of birth',
        required: true,
        properties: {},
      },
      {
        id: 'b_reason',
        ref: 'reason',
        type: 'multiple_choice',
        title: 'What brings you in?',
        required: true,
        properties: {
          choices: [
            { id: 'checkup', label: 'Routine check-up' },
            { id: 'new_symptoms', label: 'New symptoms' },
            { id: 'followup', label: 'Follow-up visit' },
            { id: 'prescription', label: 'Prescription renewal' },
          ],
        },
      },
      {
        id: 'b_symptoms',
        ref: 'symptoms',
        type: 'ai_followup',
        title: 'Tell us about your symptoms.',
        required: true,
        visibility: 'r_vis_symptoms',
        properties: {
          goal: 'Clarify when the symptoms started, how severe they are, and whether anything makes them better or worse. Never diagnose, never advise — only gather what the doctor needs to prepare.',
          maxFollowups: 2,
          fallbackQuestion:
            'When did the symptoms start, and how severe do they feel on a typical day?',
        },
      },
      {
        id: 'b_meds',
        ref: 'takes_medication',
        type: 'yes_no',
        title: 'Are you currently taking any medication?',
        required: true,
        properties: {},
      },
      {
        id: 'b_meds_list',
        ref: 'medication_list',
        type: 'long_text',
        title: 'Which medications, and what dosage?',
        required: false,
        visibility: 'r_vis_meds',
        properties: {},
      },
      {
        id: 'b_end',
        ref: 'thanks',
        type: 'thankyou',
        title: 'Thank you, {{name}} — the doctor will review this before your visit.',
        required: false,
        properties: {},
      },
    ],
    logic: [
      {
        id: 'r_vis_symptoms',
        kind: 'visibility',
        owner: { type: 'block', ref: 'b_symptoms' },
        expr: { and: [{ '==': [{ var: 'reason' }, 'new_symptoms'] }] },
      },
      {
        id: 'r_vis_meds',
        kind: 'visibility',
        owner: { type: 'block', ref: 'b_meds_list' },
        expr: { and: [{ '==': [{ var: 'takes_medication' }, true] }] },
      },
    ],
    variables: [],
    settings: {},
    theme: { brandColor: '#0e7490', appearance: 'light', fontPair: 'editorial' },
  },
}
