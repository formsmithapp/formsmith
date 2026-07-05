// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { instantiateTemplate, TEMPLATES } from '@formsmithapp/templates'
import { describe, expect, it } from 'vitest'
import { formDocumentSchema } from './document'
import { createFormInput, paginationInput, submissionInput } from './dto'

describe('formDocumentSchema (shape guard, not semantics)', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s and its instantiation pass', (_id, t) => {
    expect(formDocumentSchema.safeParse(t.document).success).toBe(true)
    expect(formDocumentSchema.safeParse(instantiateTemplate(t)).success).toBe(true)
  })

  it('keeps unknown keys (loose — newer instances may write more)', () => {
    const doc = { ...(TEMPLATES[0]?.document ?? {}), futureField: true }
    const parsed = formDocumentSchema.safeParse(doc)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect((parsed.data as Record<string, unknown>).futureField).toBe(true)
  })

  it('rejects structural garbage, not semantic subtleties', () => {
    expect(formDocumentSchema.safeParse({}).success).toBe(false) // no id/blocks
    expect(formDocumentSchema.safeParse({ id: 'x', blocks: [] }).success).toBe(false) // empty
    expect(
      formDocumentSchema.safeParse({ id: 'x', blocks: [{ id: 'b', type: 'short_text' }] }).success,
    ).toBe(false) // block without ref/title
    // semantically broken but structurally fine → PASSES here (engine's job to reject)
    expect(
      formDocumentSchema.safeParse({
        id: 'x',
        blocks: [{ id: 'b', ref: 'q', type: 'not_a_real_type', title: 'Hi' }],
      }).success,
    ).toBe(true)
  })

  it('enforces transport size bounds', () => {
    const block = (i: number) => ({ id: `b${i}`, ref: `q${i}`, type: 'short_text', title: 'q' })
    const oversized = { id: 'x', blocks: Array.from({ length: 501 }, (_, i) => block(i)) }
    expect(formDocumentSchema.safeParse(oversized).success).toBe(false)
  })
})

describe('DTOs', () => {
  it('submissionInput mirrors the runtime payload', () => {
    const payload = {
      formVersion: 1,
      answers: { plan: 'pro', pets: ['dog'] },
      variables: { score: 10 },
      hiddenFields: { visitor: 'Ada' },
    }
    expect(submissionInput.safeParse(payload).success).toBe(true)
    expect(submissionInput.safeParse({ answers: 'nope' }).success).toBe(false)
    expect(submissionInput.safeParse({}).success).toBe(false)
    // hidden values are strings only
    expect(submissionInput.safeParse({ answers: {}, hiddenFields: { visitor: 42 } }).success).toBe(
      false,
    )
  })

  it('createFormInput takes an optional seed doc; strict envelope', () => {
    expect(createFormInput.safeParse({}).success).toBe(true)
    expect(createFormInput.safeParse({ title: 'Hi' }).success).toBe(true)
    expect(createFormInput.safeParse({ doc: TEMPLATES[0]?.document }).success).toBe(true)
    expect(createFormInput.safeParse({ rogue: true }).success).toBe(false)
  })

  it('pagination coerces and bounds', () => {
    expect(paginationInput.parse({})).toEqual({ limit: 50 })
    expect(paginationInput.parse({ limit: '10' })).toEqual({ limit: 10 })
    expect(paginationInput.safeParse({ limit: 0 }).success).toBe(false)
    expect(paginationInput.safeParse({ limit: 101 }).success).toBe(false)
  })
})
