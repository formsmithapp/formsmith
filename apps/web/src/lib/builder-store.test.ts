// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type BuilderStore, createBuilderStore } from './builder-store'
import { LocalStorageFormsRepository } from './repository/local'
import type { FormsRepository, StoredForm } from './repository/types'
import { memoryStorage } from './testing/memory-storage'

let repository: FormsRepository
let stored: StoredForm
let store: BuilderStore
let clock: number

async function freshStore(overrides?: { mergeWindowMs?: number }) {
  repository = new LocalStorageFormsRepository(memoryStorage())
  stored = await repository.create()
  clock = 1_000_000
  store = createBuilderStore({
    repository,
    stored,
    now: () => clock,
    mergeWindowMs: overrides?.mergeWindowMs ?? 600,
  })
  return store
}

beforeEach(async () => {
  vi.useFakeTimers()
  await freshStore()
})
afterEach(() => {
  store.dispose()
  vi.useRealTimers()
})

const refs = () => store.getState().doc.blocks.map((b) => b.type)
const formId = () => store.getState().doc.id

describe('insertion honors the pinned layout', () => {
  it('starter: welcome, question, thankyou', () => {
    expect(refs()).toEqual(['welcome', 'short_text', 'thankyou'])
  })

  it('normal blocks land after the selected block, inside the body', () => {
    const state = store.getState()
    store.select(state.doc.blocks[0]?.id ?? null) // welcome selected
    store.insertBlock('email')
    expect(refs()).toEqual(['welcome', 'email', 'short_text', 'thankyou'])
  })

  it('thank-yous append to the tail; a second welcome is refused', () => {
    store.insertBlock('thankyou')
    expect(refs()).toEqual(['welcome', 'short_text', 'thankyou', 'thankyou'])
    expect(store.insertBlock('welcome')).toBeNull()
  })

  it('new blocks get unique, reserved-safe refs and default properties', () => {
    store.insertBlock('multiple_choice')
    store.insertBlock('multiple_choice')
    const [a, b] = store.getState().doc.blocks.filter((x) => x.type === 'multiple_choice')
    expect(a?.ref).not.toBe(b?.ref)
    expect(Array.isArray(a?.properties?.choices)).toBe(true)
  })
})

describe('move/remove/duplicate', () => {
  it('clamps moves so nothing crosses the pinned screens', () => {
    store.insertBlock('email')
    const doc = store.getState().doc
    const email = doc.blocks.find((b) => b.type === 'email')
    const welcome = doc.blocks.find((b) => b.type === 'welcome')
    const ending = doc.blocks.find((b) => b.type === 'thankyou')
    if (!email || !welcome || !ending) throw new Error('fixture')

    store.moveBlock(email.id, welcome.id) // try to take slot 0
    expect(refs()[0]).toBe('welcome')
    store.moveBlock(email.id, ending.id) // try to enter the tail
    expect(refs()[refs().length - 1]).toBe('thankyou')
    store.moveBlock(welcome.id, ending.id) // welcome never moves
    expect(refs()[0]).toBe('welcome')
  })

  it('duplicate copies properties, uniquifies the ref, selects the copy', () => {
    store.insertBlock('multiple_choice')
    const source = store.getState().doc.blocks.find((b) => b.type === 'multiple_choice')
    if (!source) throw new Error('fixture')
    store.duplicateBlock(source.id)
    const copies = store.getState().doc.blocks.filter((b) => b.type === 'multiple_choice')
    expect(copies).toHaveLength(2)
    expect(copies[0]?.ref).not.toBe(copies[1]?.ref)
    expect(copies[1]?.properties).toEqual(copies[0]?.properties)
    expect(store.getState().selectedId).toBe(copies[1]?.id)
  })

  it('remove reselects a neighbor', () => {
    const question = store.getState().doc.blocks[1]
    if (!question) throw new Error('fixture')
    store.select(question.id)
    store.removeBlock(question.id)
    expect(refs()).toEqual(['welcome', 'thankyou'])
    expect(store.getState().selectedId).toBe(store.getState().doc.blocks[1]?.id)
  })
})

describe('undo/redo with coalescing', () => {
  it('coalesces same-key edits within the window into one history entry', () => {
    const block = store.getState().doc.blocks[1]
    if (!block) throw new Error('fixture')
    store.updateBlock(block.id, { title: 'W' }, `title:${block.id}`)
    clock += 200
    store.updateBlock(block.id, { title: 'Wh' }, `title:${block.id}`)
    clock += 200
    store.updateBlock(block.id, { title: 'Why?' }, `title:${block.id}`)

    store.undo()
    expect(store.getState().doc.blocks[1]?.title).toBe('') // one undo reverts the thought
    store.redo()
    expect(store.getState().doc.blocks[1]?.title).toBe('Why?')
  })

  it('does not coalesce across the window or across keys', () => {
    const block = store.getState().doc.blocks[1]
    if (!block) throw new Error('fixture')
    store.updateBlock(block.id, { title: 'One' }, `title:${block.id}`)
    clock += 2_000
    store.updateBlock(block.id, { title: 'Two' }, `title:${block.id}`)
    store.undo()
    expect(store.getState().doc.blocks[1]?.title).toBe('One')
    store.undo()
    expect(store.getState().doc.blocks[1]?.title).toBe('')
  })

  it('a new edit clears the redo stack', () => {
    store.insertBlock('email')
    store.undo()
    expect(store.getState().canRedo).toBe(true)
    store.insertBlock('nps')
    expect(store.getState().canRedo).toBe(false)
  })

  it('selection survives undo when the block still exists, else falls back', () => {
    const id = store.insertBlock('email')
    expect(store.getState().selectedId).toBe(id)
    store.undo() // email gone
    expect(store.getState().selectedId).toBe(store.getState().doc.blocks[0]?.id)
  })
})

describe('autosave', () => {
  it('debounces to a single save and settles on saved', async () => {
    const spy = vi.spyOn(repository, 'save')
    const block = store.getState().doc.blocks[1]
    if (!block) throw new Error('fixture')
    store.updateBlock(block.id, { title: 'a' }, `title:${block.id}`)
    store.updateBlock(block.id, { title: 'ab' }, `title:${block.id}`)
    expect(store.getState().saveState).toBe('saving')
    await vi.advanceTimersByTimeAsync(750)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.getState().saveState).toBe('saved')
    const onDisk = await repository.get(formId())
    expect(onDisk?.form.blocks[1]?.title).toBe('ab')
  })

  it('flushSave persists immediately', async () => {
    const block = store.getState().doc.blocks[1]
    if (!block) throw new Error('fixture')
    store.updateBlock(block.id, { title: 'now' })
    await store.flushSave()
    expect((await repository.get(formId()))?.form.blocks[1]?.title).toBe('now')
  })
})

describe('publish', () => {
  it('flushes, validates, bumps version, snapshots immutably', async () => {
    const block = store.getState().doc.blocks[1]
    if (!block) throw new Error('fixture')
    store.updateBlock(block.id, { title: 'Original question' })
    const { version } = await store.publish()
    expect(version).toBe(1)
    expect(store.getState().status).toBe('published')

    store.updateBlock(block.id, { title: 'Edited after publish' })
    await store.flushSave()
    const snapshot = await repository.getSnapshot(formId(), 1)
    expect(snapshot?.blocks[1]?.title).toBe('Original question') // snapshot untouched
    expect((await repository.get(formId()))?.form.blocks[1]?.title).toBe('Edited after publish')
  })

  it('rejects invalid documents with issues', async () => {
    store.insertBlock('multiple_choice')
    const mc = store.getState().doc.blocks.find((b) => b.type === 'multiple_choice')
    if (!mc) throw new Error('fixture')
    store.updateProperties(mc.id, { choices: [] }) // schema requires >= 1 choice
    await expect(store.publish()).rejects.toMatchObject({ name: 'PublishValidationError' })
    expect(store.getState().status).toBe('draft')
  })
})
