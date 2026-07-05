// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { validateBlockProperties } from '@formsmithapp/blocks'
import { createEngine, evaluateSubmission } from '@formsmithapp/engine'
import { themeConfigSchema } from '@formsmithapp/ui'
import { describe, expect, it } from 'vitest'
import { getTemplate, TEMPLATES } from './index'

describe('template registry', () => {
  it('ships six templates with unique ids, the patient intake featured first', () => {
    expect(TEMPLATES).toHaveLength(6)
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(6)
    expect(TEMPLATES[0]?.id).toBe('patient-intake')
    expect(TEMPLATES[0]?.featured).toBe(true)
    expect(getTemplate('scored-quiz')?.name).toBe('Scored quiz')
    expect(getTemplate('nope')).toBeUndefined()
  })

  it.each(
    TEMPLATES.map((template) => [template.id, template] as const),
  )('%s parses in the engine (publish-gate equivalent)', (_id, template) => {
    // the same two checks the web publish gate runs
    expect(() => createEngine(template.document, { mode: 'edit' })).not.toThrow()
    for (const block of template.document.blocks) {
      const result = validateBlockProperties(block.type, block.properties ?? {})
      expect(result.ok, `${template.id}/${block.ref}: ${JSON.stringify(result)}`).toBe(true)
    }
  })

  it.each(
    TEMPLATES.map((template) => [template.id, template] as const),
  )('%s carries a valid theme and a matching accent', (_id, template) => {
    const parsed = themeConfigSchema.safeParse(template.document.theme)
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.brandColor).toBe(template.accent)
  })
})

describe('template logic actually runs', () => {
  it('scored quiz: all-correct passes with 30, all-wrong fails with 0', () => {
    const quiz = getTemplate('scored-quiz')
    if (quiz === undefined) throw new Error('fixture')
    const pass = evaluateSubmission(quiz.document, {
      answers: { q1: 'four', q2: 'paris', q3: 'mercury' },
    })
    expect(pass.ok).toBe(true)
    expect(pass.variables).toEqual({ score: 30 })
    expect(pass.ending).toBe('result_pass')

    const fail = evaluateSubmission(quiz.document, {
      answers: { q1: 'three', q2: 'london', q3: 'venus' },
    })
    expect(fail.ok).toBe(true)
    expect(fail.variables).toEqual({ score: 0 })
    expect(fail.ending).toBe('result_fail')
  })

  it('patient intake: the AI clarify step only exists on the new-symptoms path', () => {
    const intake = getTemplate('patient-intake')
    if (intake === undefined) throw new Error('fixture')
    const checkup = evaluateSubmission(intake.document, {
      answers: {
        consent: true,
        name: 'Ada',
        date_of_birth: '1990-02-28',
        reason: 'checkup',
        takes_medication: false,
      },
    })
    expect(checkup.ok).toBe(true)
    expect(checkup.path).not.toContain('symptoms')

    const symptomatic = evaluateSubmission(intake.document, {
      answers: {
        consent: true,
        name: 'Ada',
        date_of_birth: '1990-02-28',
        reason: 'new_symptoms',
        symptoms: 'Headaches since Tuesday',
        takes_medication: true,
        medication_list: 'Ibuprofen 400mg',
      },
    })
    expect(symptomatic.ok).toBe(true)
    expect(symptomatic.path).toContain('symptoms')
  })

  it('lead capture: large teams jump to the enterprise ending', () => {
    const lead = getTemplate('lead-capture')
    if (lead === undefined) throw new Error('fixture')
    const enterprise = evaluateSubmission(lead.document, {
      answers: { name: 'Ada', email: 'ada@lovelace.dev', team_size: 'large' },
    })
    expect(enterprise.ok).toBe(true)
    expect(enterprise.ending).toBe('thanks_enterprise')

    const solo = evaluateSubmission(lead.document, {
      answers: { name: 'Ada', email: 'ada@lovelace.dev', team_size: 'solo' },
    })
    expect(solo.ending).toBe('thanks')
  })
})
