// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createEngine } from '@formsmithapp/engine'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { type BuilderStore, createBuilderStore } from '../builder-store'
import { LocalStorageFormsRepository } from '../repository/local'
import { memoryStorage } from '../testing/memory-storage'
import { getJumps, getScoring, getVisibility } from './edits'
import { newRuleId } from './model'

let store: BuilderStore

/** welcome → q_plan (mc) → q_details (short_text) → ending_a, ending_b */
async function quizFixture() {
  const repository = new LocalStorageFormsRepository(memoryStorage())
  const stored = await repository.create()
  store = createBuilderStore({ repository, stored })
  const [welcome, starter] = stored.form.blocks
  if (welcome === undefined || starter === undefined) throw new Error('fixture')
  store.select(welcome.id)
  const planId = store.insertBlock('multiple_choice')
  if (planId === null) throw new Error('fixture')
  store.updateBlock(planId, { title: 'Which plan?' })
  const endingId = store.insertBlock('thankyou')
  if (endingId === null) throw new Error('fixture')
  store.setVariables([{ name: 'score', type: 'number', initialValue: 0 }])
  return { planId, starterId: starter.id, endingId }
}

beforeEach(async () => {
  vi.useFakeTimers()
  await quizFixture()
})

const doc = () => store.getState().doc
const blockById = (id: string) => {
  const block = doc().blocks.find((b) => b.id === id)
  if (block === undefined) throw new Error(`no block ${id}`)
  return block
}

describe('rule setters produce engine-valid canonical rules', () => {
  it('visibility: set, decompile back, clear', async () => {
    const { planId, starterId } = await (async () => {
      const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
      const starter = doc().blocks.find((b) => b.type === 'short_text')
      if (!plan || !starter) throw new Error('fixture')
      return { planId: plan.id, starterId: starter.id }
    })()
    store.setVisibilityGroup(starterId, {
      combinator: 'and',
      conditions: [{ ref: blockById(planId).ref, op: 'is', value: 'choice-1' }],
    })
    expect(blockById(starterId).visibility).toBeDefined()
    expect(() => createEngine(doc())).not.toThrow() // engine accepts what we author
    const state = getVisibility(doc(), blockById(starterId))
    expect(state.advanced).toBe(false)
    expect(state.group?.conditions[0]).toEqual({
      ref: blockById(planId).ref,
      op: 'is',
      value: 'choice-1',
    })

    store.setVisibilityGroup(starterId, null)
    expect(blockById(starterId).visibility).toBeUndefined()
    expect(doc().logic).toHaveLength(0)
  })

  it('jumps: branches in order + always-branch; scoring rules compile', () => {
    const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
    const ending = doc()
      .blocks.filter((b) => b.type === 'thankyou')
      .at(-1)
    if (!plan || !ending) throw new Error('fixture')

    store.setJumpBranches(plan.id, [
      {
        id: newRuleId(),
        group: { combinator: 'and', conditions: [{ ref: 'score', op: 'gte', value: 10 }] },
        targetId: ending.id,
      },
      { id: newRuleId(), group: { combinator: 'and', conditions: [] }, targetId: ending.id },
    ])
    store.setScoringRules(plan.id, [
      {
        id: newRuleId(),
        group: { combinator: 'and', conditions: [{ ref: plan.ref, op: 'is', value: 'choice-1' }] },
        op: 'add',
        amount: 10,
        variable: 'score',
      },
    ])
    expect(() => createEngine(doc())).not.toThrow()
    expect(getJumps(doc(), plan.id)).toHaveLength(2)
    expect(getJumps(doc(), plan.id)[1]?.group?.conditions).toHaveLength(0) // "always"
    expect(getScoring(doc(), plan.id)[0]).toMatchObject({
      op: 'add',
      amount: 10,
      variable: 'score',
    })
  })
})

describe('referential integrity cascades', () => {
  it('deleting a block prunes conditions, drops owned/targeting rules, strips tokens', () => {
    const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
    const starter = doc().blocks.find((b) => b.type === 'short_text')
    const ending = doc()
      .blocks.filter((b) => b.type === 'thankyou')
      .at(-1)
    if (!plan || !starter || !ending) throw new Error('fixture')

    // rules that reference the plan block in every way
    store.setVisibilityGroup(starter.id, {
      combinator: 'and',
      conditions: [
        { ref: plan.ref, op: 'is', value: 'choice-1' },
        { ref: 'score', op: 'gte', value: 5 },
      ],
    })
    store.setJumpBranches(plan.id, [
      { id: newRuleId(), group: { combinator: 'and', conditions: [] }, targetId: ending.id },
    ])
    store.setScoringRules(plan.id, [
      {
        id: newRuleId(),
        group: { combinator: 'and', conditions: [{ ref: plan.ref, op: 'answered' }] },
        op: 'add',
        amount: 10,
        variable: 'score',
      },
    ])
    store.updateBlock(ending.id, { title: `You picked {{${plan.ref}}} — {{score}} points` })

    store.removeBlock(plan.id)
    const after = doc()
    expect(() => createEngine(after)).not.toThrow() // no dangling refs anywhere
    expect(after.logic?.filter((r) => r.kind === 'jump')).toHaveLength(0)
    expect(after.logic?.filter((r) => r.kind === 'calculation')).toHaveLength(0)
    // visibility survived but lost only the pruned condition
    const vis = getVisibility(after, blockById(starter.id))
    expect(vis.group?.conditions).toEqual([{ ref: 'score', op: 'gte', value: 5 }])
    // the token for the deleted ref is stripped; other tokens stay
    const endingBlock = after.blocks.find((b) => b.id === ending.id)
    expect(endingBlock?.title).toBe('You picked  — {{score}} points')
  })

  it('renaming a ref rewrites rule vars and piping tokens', () => {
    const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
    const starter = doc().blocks.find((b) => b.type === 'short_text')
    if (!plan || !starter) throw new Error('fixture')
    store.setVisibilityGroup(starter.id, {
      combinator: 'and',
      conditions: [{ ref: plan.ref, op: 'is', value: 'choice-1' }],
    })
    store.updateBlock(starter.id, { title: 'Because {{multiple_choice}}?' })

    store.setRef(plan.id, 'chosen_plan')
    const vis = getVisibility(doc(), blockById(starter.id))
    expect(vis.group?.conditions[0]?.ref).toBe('chosen_plan')
    expect(blockById(starter.id).title).toBe('Because {{chosen_plan}}?')
    expect(() => createEngine(doc())).not.toThrow()
  })

  it('duplicating a block deep-clones its rules and rewrites self-references', () => {
    const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
    if (!plan) throw new Error('fixture')
    store.setVisibilityGroup(plan.id, {
      combinator: 'and',
      conditions: [{ ref: 'score', op: 'gte', value: 1 }],
    })
    store.setScoringRules(plan.id, [
      {
        id: newRuleId(),
        group: { combinator: 'and', conditions: [{ ref: plan.ref, op: 'is', value: 'choice-1' }] },
        op: 'add',
        amount: 10,
        variable: 'score',
      },
    ])
    store.duplicateBlock(plan.id)
    const copy = doc().blocks.find((b) => b.type === 'multiple_choice' && b.id !== plan.id)
    if (!copy) throw new Error('no copy')
    expect(copy.visibility).toBeDefined()
    expect(copy.visibility).not.toBe(blockById(plan.id).visibility) // fresh rule, not shared
    const copyScoring = getScoring(doc(), copy.id)
    expect(copyScoring).toHaveLength(1)
    expect(copyScoring[0]?.group?.conditions[0]?.ref).toBe(copy.ref) // self-ref rewritten
    expect(() => createEngine(doc())).not.toThrow()
  })

  it('deleting a variable drops its scoring rules and prunes conditions', () => {
    const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
    const starter = doc().blocks.find((b) => b.type === 'short_text')
    if (!plan || !starter) throw new Error('fixture')
    store.setScoringRules(plan.id, [
      {
        id: newRuleId(),
        group: { combinator: 'and', conditions: [] },
        op: 'add',
        amount: 5,
        variable: 'score',
      },
    ])
    store.setVisibilityGroup(starter.id, {
      combinator: 'and',
      conditions: [{ ref: 'score', op: 'gte', value: 5 }],
    })
    store.setVariables([]) // score removed
    expect(doc().logic).toHaveLength(0)
    expect(blockById(starter.id).visibility).toBeUndefined()
    expect(() => createEngine(doc())).not.toThrow()
  })

  it('hidden-field removal cascades the same way', () => {
    const starter = doc().blocks.find((b) => b.type === 'short_text')
    if (!starter) throw new Error('fixture')
    store.setHiddenFields(['utm_source'])
    store.setVisibilityGroup(starter.id, {
      combinator: 'and',
      conditions: [{ ref: 'utm_source', op: 'is', value: 'email' }],
    })
    store.setHiddenFields([])
    expect(blockById(starter.id).visibility).toBeUndefined()
    expect(doc().settings?.hiddenFields).toEqual([])
    expect(() => createEngine(doc())).not.toThrow()
  })

  it('foreign (advanced) rules referencing a deleted name are dropped whole', () => {
    const plan = doc().blocks.find((b) => b.type === 'multiple_choice')
    const starter = doc().blocks.find((b) => b.type === 'short_text')
    if (!plan || !starter) throw new Error('fixture')
    // simulate an API-authored rule outside the canon
    const advanced = {
      id: 'r_foreign',
      kind: 'visibility' as const,
      expr: { '==': [{ '+': [{ var: plan.ref }, 0] }, 1] },
    }
    store.updateBlock(starter.id, { visibility: 'r_foreign' })
    // biome-ignore lint/suspicious/noExplicitAny: injecting a raw rule for the test
    ;(doc() as any).logic.push(advanced)
    store.removeBlock(plan.id)
    expect(doc().logic?.find((r) => r.id === 'r_foreign')).toBeUndefined()
    expect(blockById(starter.id).visibility).toBeUndefined()
  })
})
