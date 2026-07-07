// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { FormDefinition } from '@formsmithapp/engine'
import { beforeEach, describe, expect, it } from 'vitest'
import { memoryStorage } from '../testing/memory-storage'
import { LocalStorageFormsRepository } from './local'
import { LocalStorageResponsesRepository, SubmissionRejectedError } from './responses'
import type { FormsRepository, StoredForm } from './types'

/** A scored mini-quiz — exercises variable recomputation on the trust path. */
function quizSeed(): FormDefinition {
  return {
    id: 'seed',
    title: 'Plan quiz',
    blocks: [
      { id: 'b_welcome', ref: 'welcome', type: 'welcome', title: 'Hi!', required: false },
      {
        id: 'b_plan',
        ref: 'plan',
        type: 'multiple_choice',
        title: 'Pick a plan',
        required: true,
        properties: {
          choices: [
            { id: 'starter', label: 'Starter' },
            { id: 'pro', label: 'Pro' },
          ],
        },
      },
      { id: 'b_end', ref: 'thanks', type: 'thankyou', title: 'Done — {{score}}', required: false },
    ],
    logic: [
      {
        id: 'r_score',
        kind: 'calculation',
        owner: { type: 'block', ref: 'b_plan' },
        expr: { '==': [{ var: 'plan' }, 'pro'] },
        action: { variable: 'score', op: 'add', value: 10 },
      },
    ],
    variables: [{ name: 'score', type: 'number' }],
    settings: {},
  }
}

let forms: FormsRepository
let responses: LocalStorageResponsesRepository
let stored: StoredForm

beforeEach(async () => {
  const storage = memoryStorage()
  forms = new LocalStorageFormsRepository(storage)
  responses = new LocalStorageResponsesRepository(storage, forms)
  stored = await forms.create(quizSeed())
  await forms.publish(stored.form.id)
})

const formId = () => stored.form.id

describe('add — the trust boundary rehearsal', () => {
  it('stores canonical answers with RECOMPUTED variables and the reached ending', async () => {
    const response = await responses.add({
      formId: formId(),
      answers: { plan: 'pro' },
    })
    expect(response.formVersion).toBe(1)
    expect(response.answers).toEqual({ plan: 'pro' })
    expect(response.variables).toEqual({ score: 10 }) // engine-computed, not client-sent
    expect(response.ending).toBe('thanks')
    expect(response.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('rejects a tampered client variable (variable_mismatch)', async () => {
    await expect(
      responses.add({
        formId: formId(),
        answers: { plan: 'starter' },
        variables: { score: 999 }, // claims points the answers don't earn
      }),
    ).rejects.toMatchObject({
      name: 'SubmissionRejectedError',
      issues: [expect.objectContaining({ code: 'variable_mismatch' })],
    })
    expect((await responses.list(formId())).responses).toEqual([])
  })

  it('rejects a skipped required answer (required_skip)', async () => {
    await expect(responses.add({ formId: formId(), answers: {} })).rejects.toMatchObject({
      issues: [expect.objectContaining({ code: 'required_skip', ref: 'plan' })],
    })
  })

  it('rejects submissions against a never-published form', async () => {
    const draft = await forms.create(quizSeed())
    await expect(
      responses.add({ formId: draft.form.id, answers: { plan: 'pro' } }),
    ).rejects.toBeInstanceOf(SubmissionRejectedError)
  })

  it('pins to the payload version when given, else the latest published', async () => {
    await forms.publish(formId()) // v2
    const latest = await responses.add({ formId: formId(), answers: { plan: 'pro' } })
    expect(latest.formVersion).toBe(2)
    const pinned = await responses.add({
      formId: formId(),
      formVersion: 1,
      answers: { plan: 'starter' },
    })
    expect(pinned.formVersion).toBe(1)
  })
})

describe('list / get / remove / clear', () => {
  it('lists newest first', async () => {
    const first = await responses.add({ formId: formId(), answers: { plan: 'starter' } })
    const second = await responses.add({ formId: formId(), answers: { plan: 'pro' } })
    const page = await responses.list(formId())
    expect(page.responses.map((r) => r.id)).toEqual([second.id, first.id])
    expect(page.nextCursor).toBeNull()
  })

  it('paginates by keyset cursor without overlap or gaps', async () => {
    const added = []
    for (let i = 0; i < 5; i += 1) {
      added.push(await responses.add({ formId: formId(), answers: { plan: 'pro' } }))
    }
    const newestFirst = [...added].reverse().map((r) => r.id)

    const first = await responses.list(formId(), { limit: 2 })
    expect(first.responses.map((r) => r.id)).toEqual(newestFirst.slice(0, 2))
    expect(first.nextCursor).not.toBeNull()

    const second = await responses.list(formId(), {
      limit: 2,
      cursor: first.nextCursor ?? undefined,
    })
    expect(second.responses.map((r) => r.id)).toEqual(newestFirst.slice(2, 4))

    const third = await responses.list(formId(), {
      limit: 2,
      cursor: second.nextCursor ?? undefined,
    })
    expect(third.responses.map((r) => r.id)).toEqual(newestFirst.slice(4))
    expect(third.nextCursor).toBeNull()
  })

  it('summary reports the total and per-question counts server-parity', async () => {
    await responses.add({ formId: formId(), answers: { plan: 'pro' } })
    await responses.add({ formId: formId(), answers: { plan: 'pro' } })
    await responses.add({ formId: formId(), answers: { plan: 'starter' } })

    const { total, summary } = await responses.summary(formId())
    expect(total).toBe(3)
    const plan = summary.find((entry) => entry.block.ref === 'plan')
    expect(plan?.kind).toBe('choices')
    if (plan?.kind === 'choices') {
      expect(plan.answered).toBe(3)
      expect(plan.options).toEqual([
        { label: 'Starter', count: 1 },
        { label: 'Pro', count: 2 },
      ])
    }
  })

  it('get finds by id; remove deletes one; clear deletes all', async () => {
    const a = await responses.add({ formId: formId(), answers: { plan: 'pro' } })
    const b = await responses.add({ formId: formId(), answers: { plan: 'starter' } })
    expect((await responses.get(formId(), a.id))?.id).toBe(a.id)

    await responses.remove(formId(), a.id)
    expect(await responses.get(formId(), a.id)).toBeNull()
    expect((await responses.list(formId())).responses.map((r) => r.id)).toEqual([b.id])

    await responses.clear(formId())
    expect((await responses.list(formId())).responses).toEqual([])
  })
})
