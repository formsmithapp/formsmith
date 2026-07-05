// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../testing/memory-storage'
import { LocalStorageFormsRepository } from './local'

const fresh = () => new LocalStorageFormsRepository(memoryStorage())

describe('LocalStorageFormsRepository', () => {
  it('create → list → get round-trips with a starter skeleton', async () => {
    const repo = fresh()
    const created = await repo.create()
    const list = await repo.list()
    expect(list).toHaveLength(1)
    expect(list[0]?.status).toBe('draft')
    expect(list[0]?.blockCount).toBe(3)
    const loaded = await repo.get(created.form.id)
    expect(loaded?.form.blocks.map((b) => b.type)).toEqual(['welcome', 'short_text', 'thankyou'])
  })

  it('save updates the doc and the index metadata', async () => {
    const repo = fresh()
    const { form } = await repo.create()
    await repo.save(form.id, { ...form, title: 'Renamed' })
    expect((await repo.get(form.id))?.form.title).toBe('Renamed')
    expect((await repo.list())[0]?.title).toBe('Renamed')
  })

  it('publish versions immutably; duplicate resets to draft; remove clears all keys', async () => {
    const repo = fresh()
    const { form } = await repo.create()
    expect((await repo.publish(form.id)).version).toBe(1)
    expect((await repo.publish(form.id)).version).toBe(2)
    expect((await repo.getSnapshot(form.id, 1))?.version).toBe(1)

    const copy = await repo.duplicate(form.id)
    expect(copy.status).toBe('draft')
    expect(copy.form.id).not.toBe(form.id)
    expect(copy.form.title).toContain('(copy)')

    await repo.remove(form.id)
    expect(await repo.get(form.id)).toBeNull()
    expect(await repo.getSnapshot(form.id, 1)).toBeNull()
    expect((await repo.list()).map((s) => s.id)).toEqual([copy.form.id])
  })

  it('publish rejects an engine-invalid document', async () => {
    const repo = fresh()
    const { form } = await repo.create()
    const broken = {
      ...form,
      blocks: form.blocks.map((b) => ({ ...b, ref: 'same_ref' })), // duplicate refs
    }
    await repo.save(form.id, broken)
    await expect(repo.publish(form.id)).rejects.toMatchObject({
      name: 'PublishValidationError',
    })
  })
})
