// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { createEngine } from './engine'
import { FormValidationError } from './errors'
import { linearForm } from './fixtures'
import type { FormDefinition } from './types'

const expectRejected = (form: FormDefinition, ...fragments: string[]) => {
  let caught: unknown
  try {
    createEngine(form)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(FormValidationError)
  const issues = (caught as FormValidationError).issues.join('\n')
  for (const fragment of fragments) expect(issues).toContain(fragment)
}

const base = (): FormDefinition => ({
  id: 'form_boundary',
  blocks: [
    { id: 'b1', ref: 'q1', type: 'short_text', title: 'Q1' },
    { id: 'b2', ref: 'q2', type: 'short_text', title: 'Q2' },
    { id: 'b_end', ref: 'ending', type: 'thankyou', title: 'End' },
  ],
})

describe('form definitions are untrusted input', () => {
  it('accepts a well-formed definition', () => {
    expect(() => createEngine(linearForm())).not.toThrow()
  })

  it('rejects duplicate block ids and refs', () => {
    const dupId = base()
    dupId.blocks[1] = { ...dupId.blocks[1], id: 'b1' } as never
    expectRejected(dupId, 'duplicate block id')

    const dupRef = base()
    dupRef.blocks[1] = { ...dupRef.blocks[1], ref: 'q1' } as never
    expectRejected(dupRef, 'duplicate block ref')
  })

  it('rejects refs that are not dot-free slugs', () => {
    const form = base()
    form.blocks[0] = { ...form.blocks[0], ref: 'a.b' } as never
    expectRejected(form, 'dot-free slug')
  })

  it('rejects unknown block types', () => {
    const form = base()
    form.blocks[0] = { ...form.blocks[0], type: 'hologram' } as never
    expectRejected(form, 'unknown block type "hologram"')
  })

  it('rejects rules using operators outside the allowlist', () => {
    const form = base()
    form.logic = [{ id: 'v1', kind: 'visibility', expr: { map: [{ var: 'q1' }, { var: '' }] } }]
    form.blocks[1] = { ...form.blocks[1], visibility: 'v1' } as never
    expectRejected(form, 'rule "v1"')
  })

  it('rejects rules referencing unknown refs', () => {
    const form = base()
    form.logic = [{ id: 'v1', kind: 'visibility', expr: { '==': [{ var: 'ghost' }, 1] } }]
    form.blocks[1] = { ...form.blocks[1], visibility: 'v1' } as never
    expectRejected(form, 'ghost')
  })

  it('rejects depth-bomb rule ASTs without blowing the stack', () => {
    let bomb: unknown = { var: 'q1' }
    for (let i = 0; i < 5_000; i++) bomb = { '!': [bomb] }
    const form = base()
    form.logic = [{ id: 'v1', kind: 'visibility', expr: bomb }]
    form.blocks[1] = { ...form.blocks[1], visibility: 'v1' } as never
    expectRejected(form, 'rule "v1"')
  })

  it('rejects visibility pointers to missing or wrong-kind rules', () => {
    const missing = base()
    missing.blocks[1] = { ...missing.blocks[1], visibility: 'nope' } as never
    expectRejected(missing, 'unknown rule "nope"')

    const wrongKind = base()
    wrongKind.variables = [{ name: 'score', type: 'number' }]
    wrongKind.logic = [
      {
        id: 'c1',
        kind: 'calculation',
        expr: true,
        action: { variable: 'score', op: 'set', value: 1 },
      },
    ]
    wrongKind.blocks[1] = { ...wrongKind.blocks[1], visibility: 'c1' } as never
    expectRejected(wrongKind, 'kind "visibility"')
  })

  it('rejects jumps with unresolvable owners or targets', () => {
    const badOwner = base()
    badOwner.logic = [
      {
        id: 'j1',
        kind: 'jump',
        owner: { type: 'block', ref: 'ghost' },
        expr: true,
        action: { target: 'q2' },
      },
    ]
    expectRejected(badOwner, 'jump owner')

    const badTarget = base()
    badTarget.logic = [
      {
        id: 'j1',
        kind: 'jump',
        owner: { type: 'block', ref: 'q1' },
        expr: true,
        action: { target: 'ghost' },
      },
    ]
    expectRejected(badTarget, 'jump target')
  })

  it('rejects calculations that target undeclared variables', () => {
    const form = base()
    form.logic = [
      {
        id: 'c1',
        kind: 'calculation',
        expr: true,
        action: { variable: 'ghost', op: 'add', value: 1 },
      },
    ]
    expectRejected(form, 'declared variable')
  })

  it('rejects name collisions across refs, variables, and hidden fields', () => {
    const varClash = base()
    varClash.variables = [{ name: 'q1' }]
    expectRejected(varClash, 'collides')

    const hiddenClash = base()
    hiddenClash.variables = [{ name: 'score' }]
    hiddenClash.settings = { hiddenFields: ['score'] }
    expectRejected(hiddenClash, 'collides')
  })

  it('rejects broken validation constraints', () => {
    const badPattern = base()
    badPattern.blocks[0] = {
      ...badPattern.blocks[0],
      validations: [{ type: 'pattern', value: '(' }],
    } as never
    expectRejected(badPattern, 'pattern does not compile')

    const hugePattern = base()
    hugePattern.blocks[0] = {
      ...hugePattern.blocks[0],
      validations: [{ type: 'pattern', value: 'a'.repeat(201) }],
    } as never
    expectRejected(hugePattern, 'exceeds 200 characters')

    const badType = base()
    badType.blocks[0] = {
      ...badType.blocks[0],
      validations: [{ type: 'levitates', value: 1 }],
    } as never
    expectRejected(badType, 'unknown validation type')
  })

  it('rejects reserved slugs (kept free for future namespaced tokens)', () => {
    const refForm = base()
    refForm.blocks[0] = { ...refForm.blocks[0], ref: 'hidden' } as never
    expectRejected(refForm, 'reserved word')

    const varForm = base()
    varForm.variables = [{ name: 'var' }]
    expectRejected(varForm, 'reserved word')

    const hiddenFieldForm = base()
    hiddenFieldForm.settings = { hiddenFields: ['field'] }
    expectRejected(hiddenFieldForm, 'reserved word')
  })

  it('rejects visibility rules referencing later blocks or the block itself', () => {
    const forward = base()
    forward.logic = [{ id: 'v1', kind: 'visibility', expr: { '==': [{ var: 'q2' }, 'x'] } }]
    forward.blocks[0] = { ...forward.blocks[0], visibility: 'v1' } as never
    expectRejected(forward, 'comes later in the form')

    const selfRef = base()
    selfRef.logic = [{ id: 'v1', kind: 'visibility', expr: { '==': [{ var: 'q1' }, 'x'] } }]
    selfRef.blocks[0] = { ...selfRef.blocks[0], visibility: 'v1' } as never
    expectRejected(selfRef, "block's own answer")
  })

  it('rejects jump conditions referencing blocks after the jump owner', () => {
    const form = base()
    form.logic = [
      {
        id: 'j1',
        kind: 'jump',
        owner: { type: 'block', ref: 'q1' },
        expr: { '==': [{ var: 'q2' }, 'x'] },
        action: { target: 'ending' },
      },
    ]
    expectRejected(form, 'comes after its block')
  })

  it('allows conditions on earlier blocks, own answers (jumps), variables, and hidden fields', () => {
    const form = base()
    form.variables = [{ name: 'score', type: 'number' }]
    form.settings = { hiddenFields: ['utm'] }
    form.logic = [
      {
        id: 'v1',
        kind: 'visibility',
        expr: {
          and: [
            { '==': [{ var: 'q1' }, 'x'] },
            { '==': [{ var: 'utm' }, 'email'] },
            { '>': [{ var: 'score' }, 1] },
          ],
        },
      },
      {
        id: 'j1',
        kind: 'jump',
        owner: { type: 'block', ref: 'q2' },
        expr: { '==': [{ var: 'q2' }, 'x'] }, // a jump may read its own block's answer
        action: { target: 'ending' }, // …and its *target* may point forward — that's the point
      },
    ]
    form.blocks[1] = { ...form.blocks[1], visibility: 'v1' } as never
    expect(() => createEngine(form)).not.toThrow()
  })

  it('collects every issue in one error', () => {
    const form = base()
    form.blocks[1] = { ...form.blocks[1], ref: 'q1' } as never
    form.variables = [{ name: 'bad name' }]
    form.logic = [{ id: 'v1', kind: 'visibility', expr: { evil: [] } }]
    let caught: FormValidationError | undefined
    try {
      createEngine(form)
    } catch (error) {
      caught = error as FormValidationError
    }
    expect(caught?.issues.length).toBeGreaterThanOrEqual(3)
  })

  it('rejects a non-object or block-less definition', () => {
    expect(() => createEngine(null as unknown as FormDefinition)).toThrow(FormValidationError)
    expect(() => createEngine({ id: 'x' } as unknown as FormDefinition)).toThrow(
      FormValidationError,
    )
  })
})
