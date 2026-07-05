// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block, BlockType, FormDefinition } from '@formsmithapp/engine'
import type { FormsRepository, StoredForm } from './repository/types'
import { makeBlock } from './seed'
import { uniqueRef } from './slug'

/**
 * The builder's document store — same hand-rolled `getState`/`subscribe`
 * contract as the engine, bound to React via useSyncExternalStore.
 *
 * Undo/redo is SNAPSHOT-based (forms are small JSON; snapshots are trivially
 * correct). High-frequency edits coalesce via merge keys: consecutive commits
 * with the same key within the merge window collapse into one history entry,
 * so undo reverts a thought, not a keystroke. Selection/UI never enter
 * history.
 */

export type SaveState = 'idle' | 'saving' | 'saved'

export interface BuilderState {
  doc: FormDefinition
  selectedId: string | null
  saveState: SaveState
  status: 'draft' | 'published'
  publishedVersion?: number
  canUndo: boolean
  canRedo: boolean
  paletteOpen: boolean
  previewMode: boolean
}

export interface BuilderStoreOptions {
  repository: FormsRepository
  stored: StoredForm
  /** Autosave debounce (design: 750ms). */
  debounceMs?: number
  /** Coalescing window for same-mergeKey edits. */
  mergeWindowMs?: number
  now?: () => number
}

const HISTORY_CAP = 100

const SCREEN_TYPES = new Set(['welcome', 'statement', 'thankyou'])

/** First index a normal block may occupy (after a pinned welcome). */
function firstBodyIndex(doc: FormDefinition): number {
  return doc.blocks[0]?.type === 'welcome' ? 1 : 0
}

/** Start of the pinned thank-you tail (== blocks.length when there is none). */
function tailStart(doc: FormDefinition): number {
  let index = doc.blocks.length
  while (index > 0 && doc.blocks[index - 1]?.type === 'thankyou') index--
  return index
}

export function createBuilderStore(options: BuilderStoreOptions) {
  const { repository, stored } = options
  const debounceMs = options.debounceMs ?? 750
  const mergeWindowMs = options.mergeWindowMs ?? 600
  const now = options.now ?? (() => Date.now())
  const formId = stored.form.id

  let state: BuilderState = {
    doc: stored.form,
    selectedId: stored.form.blocks[0]?.id ?? null,
    saveState: 'idle',
    status: stored.status,
    publishedVersion: stored.publishedVersion,
    canUndo: false,
    canRedo: false,
    paletteOpen: false,
    previewMode: false,
  }

  const listeners = new Set<() => void>()
  let past: FormDefinition[] = []
  let future: FormDefinition[] = []
  let lastMergeKey: string | null = null
  let lastEditAt = 0
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const setState = (patch: Partial<BuilderState>) => {
    state = { ...state, ...patch, canUndo: past.length > 0, canRedo: future.length > 0 }
    for (const listener of [...listeners]) listener()
  }

  const scheduleSave = () => {
    if (saveTimer !== null) clearTimeout(saveTimer)
    setState({ saveState: 'saving' })
    saveTimer = setTimeout(() => {
      saveTimer = null
      void persist()
    }, debounceMs)
  }

  async function persist(): Promise<void> {
    try {
      await repository.save(formId, state.doc)
      setState({ saveState: 'saved' })
    } catch {
      setState({ saveState: 'idle' })
    }
  }

  /** Every document mutation funnels through here. */
  const commit = (nextDoc: FormDefinition, mergeKey?: string) => {
    const timestamp = now()
    const merged =
      mergeKey !== undefined && mergeKey === lastMergeKey && timestamp - lastEditAt < mergeWindowMs
    if (!merged) {
      past = [...past.slice(-(HISTORY_CAP - 1)), state.doc]
      future = []
    }
    lastMergeKey = mergeKey ?? null
    lastEditAt = timestamp
    setState({ doc: nextDoc })
    scheduleSave()
  }

  const patchBlocks = (blocks: Block[]): FormDefinition => ({ ...state.doc, blocks })

  const blockIndex = (id: string) => state.doc.blocks.findIndex((b) => b.id === id)

  const takenRefs = () => new Set(state.doc.blocks.map((b) => b.ref))

  return {
    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    select(id: string | null) {
      setState({ selectedId: id })
    },
    setPaletteOpen(open: boolean) {
      setState({ paletteOpen: open })
    },
    setPreviewMode(on: boolean) {
      setState({ previewMode: on })
    },

    updateFormTitle(title: string) {
      commit({ ...state.doc, title }, 'form:title')
    },

    updateBlock(id: string, patch: Partial<Block>, mergeKey?: string) {
      const blocks = state.doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b))
      commit(patchBlocks(blocks), mergeKey)
    },

    updateProperties(id: string, patch: Record<string, unknown>, mergeKey?: string) {
      const blocks = state.doc.blocks.map((block) => {
        if (block.id !== id) return block
        const properties = { ...block.properties, ...patch }
        for (const [key, value] of Object.entries(patch)) {
          if (value === undefined) delete properties[key]
        }
        return { ...block, properties }
      })
      commit(patchBlocks(blocks), mergeKey)
    },

    setRef(id: string, ref: string) {
      const blocks = state.doc.blocks.map((b) => (b.id === id ? { ...b, ref } : b))
      commit(patchBlocks(blocks))
    },

    /**
     * Inserts a block honoring the pinned layout: welcome only at 0 and only
     * once; thank-yous append to the pinned tail; everything else lands after
     * the selected block, clamped into the body zone.
     */
    insertBlock(type: BlockType): string | null {
      const doc = state.doc
      if (type === 'welcome' && doc.blocks.some((b) => b.type === 'welcome')) return null
      const block = makeBlock(type, takenRefs())
      let at: number
      if (type === 'welcome') at = 0
      else if (type === 'thankyou') at = doc.blocks.length
      else {
        const selectedIndex = state.selectedId !== null ? blockIndex(state.selectedId) : -1
        const wanted = selectedIndex >= 0 ? selectedIndex + 1 : tailStart(doc)
        at = Math.min(Math.max(wanted, firstBodyIndex(doc)), tailStart(doc))
      }
      const blocks = [...doc.blocks.slice(0, at), block, ...doc.blocks.slice(at)]
      commit(patchBlocks(blocks))
      setState({ selectedId: block.id })
      return block.id
    },

    removeBlock(id: string) {
      const index = blockIndex(id)
      if (index < 0) return
      const blocks = state.doc.blocks.filter((b) => b.id !== id)
      const neighbor = blocks[Math.min(index, blocks.length - 1)]
      commit(patchBlocks(blocks))
      if (state.selectedId === id) setState({ selectedId: neighbor?.id ?? null })
    },

    duplicateBlock(id: string) {
      const index = blockIndex(id)
      const source = state.doc.blocks[index]
      if (source === undefined) return
      const copy: Block = {
        ...structuredClone(source),
        id: crypto.randomUUID(),
        ref: uniqueRef(source.ref, takenRefs()),
      }
      const at = Math.min(index + 1, source.type === 'welcome' ? 1 : tailStart(state.doc))
      const blocks =
        source.type === 'welcome'
          ? state.doc.blocks // a second welcome is not allowed — no-op
          : [...state.doc.blocks.slice(0, at), copy, ...state.doc.blocks.slice(at)]
      if (blocks === state.doc.blocks) return
      commit(patchBlocks(blocks))
      setState({ selectedId: copy.id })
    },

    /** dnd handler: moves `activeId` to `overId`'s slot, clamped to legal zones. */
    moveBlock(activeId: string, overId: string) {
      const doc = state.doc
      const from = blockIndex(activeId)
      const to = blockIndex(overId)
      if (from < 0 || to < 0 || from === to) return
      const moving = doc.blocks[from]
      if (moving === undefined || moving.type === 'welcome') return
      const without = doc.blocks.filter((b) => b.id !== activeId)
      const min = doc.blocks[0]?.type === 'welcome' ? 1 : 0
      let target = to
      if (moving.type === 'thankyou') {
        // endings reorder only within the tail
        const tail = tailStart({ ...doc, blocks: without })
        target = Math.max(target, tail)
      } else {
        const tail = tailStart({ ...doc, blocks: without })
        target = Math.min(Math.max(target, min), tail)
      }
      const blocks = [...without.slice(0, target), moving, ...without.slice(target)]
      commit(patchBlocks(blocks))
    },

    undo() {
      const previous = past[past.length - 1]
      if (previous === undefined) return
      past = past.slice(0, -1)
      future = [...future, state.doc]
      lastMergeKey = null
      const selected = previous.blocks.some((b) => b.id === state.selectedId)
        ? state.selectedId
        : (previous.blocks[0]?.id ?? null)
      setState({ doc: previous, selectedId: selected })
      scheduleSave()
    },

    redo() {
      const next = future[future.length - 1]
      if (next === undefined) return
      future = future.slice(0, -1)
      past = [...past, state.doc]
      lastMergeKey = null
      const selected = next.blocks.some((b) => b.id === state.selectedId)
        ? state.selectedId
        : (next.blocks[0]?.id ?? null)
      setState({ doc: next, selectedId: selected })
      scheduleSave()
    },

    /** Forces any pending autosave to disk right now (pre-publish/preview). */
    async flushSave() {
      if (saveTimer !== null) {
        clearTimeout(saveTimer)
        saveTimer = null
        await persist()
      }
    },

    async publish(): Promise<{ version: number }> {
      await this.flushSave()
      const result = await repository.publish(formId)
      setState({ status: 'published', publishedVersion: result.version })
      return result
    },

    dispose() {
      if (saveTimer !== null) clearTimeout(saveTimer)
      listeners.clear()
    },
  }
}

export type BuilderStore = ReturnType<typeof createBuilderStore>
export { SCREEN_TYPES }
