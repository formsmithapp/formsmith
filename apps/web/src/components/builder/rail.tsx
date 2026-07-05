// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getBlockDefinition } from '@formsmithapp/blocks'
import type { Block } from '@formsmithapp/engine'
import { Copy, Eye, GripVertical, Plus, Sigma, Split, Trash2 } from 'lucide-react'
import { SCREEN_TYPES } from '@/lib/builder-store'
import { BlockIconTile } from './block-icons'
import { useBuilder, useBuilderState } from './store-context'

function RailRow({
  block,
  questionNumber,
  selected,
  glyphs,
}: {
  block: Block
  questionNumber: number | null
  selected: boolean
  glyphs: { visibility: boolean; jumps: boolean; scoring: boolean }
}) {
  const store = useBuilder()
  const pinned = block.type === 'welcome'
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block.id,
    disabled: pinned,
  })
  const definition = getBlockDefinition(block.type)
  const ai = block.type === 'ai_followup'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'z-10 opacity-90' : undefined}
    >
      <div
        data-rail-row={block.ref}
        className={`group flex w-full items-center gap-2 rounded-[10px] border py-2 pr-2.5 pl-1 transition-colors ${
          selected ? 'border-brand/30 bg-brand-soft' : 'border-transparent hover:bg-surface-hover'
        } ${isDragging ? 'bg-surface-2 shadow-md' : ''}`}
      >
        {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: dnd-kit's spread supplies role+tabindex at runtime */}
        <span
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${definition?.displayName ?? block.type}`}
          className={`touch-none text-fg-3 ${
            pinned ? 'invisible' : 'cursor-grab opacity-0 group-hover:opacity-100'
          }`}
        >
          <GripVertical size={13} />
        </span>
        <button
          type="button"
          onClick={() => store.select(block.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <BlockIconTile iconKey={definition?.iconKey ?? ''} selected={selected} ai={ai} />
          <span className="min-w-0 flex-1 max-[1040px]:hidden">
            <span className="block truncate text-[13px] leading-tight font-medium">
              {block.title !== '' ? block.title : (definition?.displayName ?? block.type)}
            </span>
            <span className="flex items-center gap-1 font-mono text-[9.5px] tracking-[0.08em] text-fg-3 uppercase">
              {definition?.displayName ?? block.type}
              {glyphs.visibility && <Eye size={9} aria-label="Has visibility rule" />}
              {glyphs.jumps && <Split size={9} aria-label="Has jump logic" />}
              {glyphs.scoring && <Sigma size={9} aria-label="Has scoring" />}
            </span>
          </span>
        </button>
        <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 max-[1040px]:hidden">
          {block.type !== 'welcome' && (
            <button
              type="button"
              aria-label="Duplicate block"
              onClick={(event) => {
                event.stopPropagation()
                store.duplicateBlock(block.id)
              }}
              className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-fg"
            >
              <Copy size={12} />
            </button>
          )}
          <button
            type="button"
            aria-label="Delete block"
            onClick={(event) => {
              event.stopPropagation()
              store.removeBlock(block.id)
            }}
            className="grid size-6 place-items-center rounded-md text-fg-3 hover:bg-surface-2 hover:text-error"
          >
            <Trash2 size={12} />
          </button>
        </span>
        <span
          className={`w-5 text-right font-mono text-[10.5px] tabular-nums max-[1040px]:hidden ${
            ai ? 'font-semibold text-brand' : 'text-fg-3'
          }`}
          aria-hidden="true"
        >
          {questionNumber ?? '·'}
        </span>
      </div>
    </li>
  )
}

export function Rail() {
  const store = useBuilder()
  const state = useBuilderState()
  const blocks = state.doc.blocks
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id
    if (typeof overId === 'string' && typeof event.active.id === 'string') {
      store.moveBlock(event.active.id, overId)
    }
  }

  let question = 0
  return (
    <aside className="flex min-h-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center justify-between px-4 pt-4 pb-2 max-[1040px]:hidden">
        <span className="eyebrow text-fg-3">Content</span>
        <span className="font-mono text-[10.5px] text-fg-3 tabular-nums">{blocks.length}</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-1">
            {blocks.map((block) => {
              const answerable = !SCREEN_TYPES.has(block.type)
              if (answerable) question += 1
              const logic = state.doc.logic ?? []
              return (
                <RailRow
                  key={block.id}
                  block={block}
                  questionNumber={answerable ? question : null}
                  selected={state.selectedId === block.id}
                  glyphs={{
                    visibility: block.visibility !== undefined,
                    jumps: logic.some(
                      (rule) => rule.kind === 'jump' && rule.owner?.ref === block.id,
                    ),
                    scoring: logic.some(
                      (rule) => rule.kind === 'calculation' && rule.owner?.ref === block.id,
                    ),
                  }}
                />
              )
            })}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="p-2.5">
        <button
          type="button"
          onClick={() => store.setPaletteOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-line border-dashed py-2.5 text-[13px] font-medium text-fg-2 transition-colors hover:border-brand/40 hover:text-brand"
        >
          <Plus size={14} />
          <span className="max-[1040px]:hidden">Add block</span>
          <kbd className="rounded border border-line bg-surface-2 px-1.5 font-mono text-[10px] max-[1040px]:hidden">
            ⌘K
          </kbd>
        </button>
      </div>
    </aside>
  )
}
