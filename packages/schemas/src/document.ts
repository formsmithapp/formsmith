// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'

/**
 * The form-document SHAPE guard — a deliberately loose structural check for
 * transport/storage boundaries ("is this a plausible form document?") with
 * light size bounds as DoS hygiene.
 *
 * HARD BOUNDARY: deep semantic validation lives elsewhere and is NOT
 * duplicated here — engine parse + blocks property schemas gate publishing,
 * `evaluateSubmission` gates submissions. `properties`/`expr`/`theme` pass
 * through as unknown on purpose; their owners validate them.
 */

const slug = z.string().min(1).max(200)

const blockShape = z.looseObject({
  id: z.string().min(1).max(200),
  ref: slug,
  type: z.string().min(1).max(100),
  title: z.string().max(2_000),
  description: z.string().max(5_000).optional(),
  required: z.boolean().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  visibility: z.string().max(200).optional(),
  validations: z
    .array(z.looseObject({ type: z.string().min(1) }))
    .max(20)
    .optional(),
})

const ruleShape = z.looseObject({
  id: z.string().min(1).max(200),
  kind: z.enum(['visibility', 'jump', 'calculation', 'trigger']),
  owner: z.looseObject({ type: z.enum(['block', 'form']), ref: z.string().optional() }).optional(),
  expr: z.unknown(),
  action: z
    .looseObject({
      target: z.string().optional(),
      variable: z.string().optional(),
      op: z.enum(['set', 'add']).optional(),
      value: z.unknown().optional(),
    })
    .optional(),
})

const variableShape = z.looseObject({
  name: slug,
  type: z.enum(['number', 'string', 'boolean']).optional(),
  initialValue: z.unknown().optional(),
})

export const formDocumentSchema = z.looseObject({
  id: z.string().min(1).max(200),
  title: z.string().max(500).optional(),
  version: z.number().int().positive().optional(),
  blocks: z.array(blockShape).min(1).max(500),
  logic: z.array(ruleShape).max(1_000).optional(),
  variables: z.array(variableShape).max(200).optional(),
  settings: z.looseObject({ hiddenFields: z.array(slug).max(50).optional() }).optional(),
  /** ThemeConfig-shaped; owners validate (ui's parseThemeConfig fail-softs). */
  theme: z.record(z.string(), z.unknown()).optional(),
})

export type FormDocumentShape = z.infer<typeof formDocumentSchema>
