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

/** Mirrors the renderer's SubmissionPayload / the engine's Submission. */
export const submissionInput = z.strictObject({
  formVersion: z.number().int().positive().optional(),
  answers: z.record(z.string().max(200), z.unknown()),
  /** Client-computed — cross-checked server-side, never trusted. */
  variables: z.record(z.string().max(200), z.unknown()).optional(),
  hiddenFields: z.record(z.string().max(200), z.string().max(1_000)).optional(),
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
