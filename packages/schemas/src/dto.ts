// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import { formDocumentSchema } from './document'

/** API I/O envelopes — the contracts the data plane (S2) will mount verbatim. */

export const createFormInput = z.strictObject({
  title: z.string().max(500).optional(),
  /** Optional seed document (template instantiation happens client- or server-side). */
  doc: formDocumentSchema.optional(),
})

export const updateFormInput = z.strictObject({
  doc: formDocumentSchema,
})

/** A server-issued AI exchange returned by the client. `sig` proves the
 * server generated `question`+`meta`; the answer alone is untrusted input. */
export const aiExchange = z.strictObject({
  ref: z.string().max(200),
  index: z.number().int().min(1).max(5),
  question: z.string().max(500),
  meta: z.record(z.string(), z.unknown()),
  sig: z.string().max(128),
  answer: z.string().max(10_000),
})

/** Mirrors the renderer's SubmissionPayload / the engine's Submission. */
export const submissionInput = z.strictObject({
  formVersion: z.number().int().positive().optional(),
  answers: z.record(z.string().max(200), z.unknown()),
  /** Client-computed — cross-checked server-side, never trusted. */
  variables: z.record(z.string().max(200), z.unknown()).optional(),
  hiddenFields: z.record(z.string().max(200), z.string().max(1_000)).optional(),
  /** AI follow-up exchanges — every sig is verified server-side. */
  aiExchanges: z.array(aiExchange).max(10).optional(),
  /** Honeypot — humans never see the field; non-empty means a bot filled it
   * (the server accepts-and-discards, indistinguishable from success). */
  _hp: z.string().max(500).optional(),
})

/** `POST /f/:id/ai` — request the next follow-up in an exchange. */
export const aiFollowupInput = z.strictObject({
  ref: z.string().max(200),
  index: z.number().int().min(1).max(5),
  baseAnswer: z.string().max(10_000),
  exchanges: z
    .array(aiExchange.omit({ ref: true }))
    .max(5)
    .default([]),
})

/** `POST /forms/generate` — AI form generation (session-only). */
export const generateFormInput = z.strictObject({
  prompt: z.string().min(3).max(500),
})

export const responseDto = z.strictObject({
  id: z.string(),
  formId: z.string(),
  formVersion: z.number().int().positive(),
  submittedAt: z.iso.datetime(),
  answers: z.record(z.string(), z.unknown()),
  variables: z.record(z.string(), z.unknown()),
  hidden: z.record(z.string(), z.string()),
  ending: z.string().nullable(),
})

export const paginationInput = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().max(500).optional(),
})

/** Local-first migration: forms + published snapshots. NEVER responses —
 * they were never server-verified. */
export const importFormEntry = z.strictObject({
  /** The browser-side id, echoed back so the client can clean up. */
  sourceId: z.string().max(200),
  doc: formDocumentSchema,
  status: z.enum(['draft', 'published']).default('draft'),
  publishedVersion: z.number().int().positive().optional(),
  versions: z
    .array(z.strictObject({ version: z.number().int().positive(), doc: formDocumentSchema }))
    .max(100)
    .default([]),
})

export const importInput = z.strictObject({
  forms: z.array(importFormEntry).min(1).max(200),
})

/* ---------- Connect (S3) ---------- */

export const createApiKeyInput = z.strictObject({
  name: z.string().min(1).max(100),
})

/** https required except localhost — self-host operators test locally. */
export const createWebhookInput = z.strictObject({
  url: z
    .url()
    .max(2_000)
    .refine((value) => {
      try {
        const url = new URL(value)
        if (url.protocol === 'https:') return true
        if (url.protocol !== 'http:') return false
        return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      } catch {
        return false
      }
    }, 'must be an https URL (http is allowed for localhost only)'),
})

export type CreateFormInput = z.infer<typeof createFormInput>
export type UpdateFormInput = z.infer<typeof updateFormInput>
export type SubmissionInput = z.infer<typeof submissionInput>
export type ResponseDto = z.infer<typeof responseDto>
export type PaginationInput = z.infer<typeof paginationInput>
export type ImportFormEntry = z.infer<typeof importFormEntry>
export type ImportInput = z.infer<typeof importInput>
export type CreateApiKeyInput = z.infer<typeof createApiKeyInput>
export type CreateWebhookInput = z.infer<typeof createWebhookInput>
export type AiExchange = z.infer<typeof aiExchange>
export type AiFollowupInput = z.infer<typeof aiFollowupInput>
export type GenerateFormInput = z.infer<typeof generateFormInput>
