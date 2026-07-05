// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { type BlockDefinition, v1BlockDefinitions } from '@formsmithapp/blocks'
import type { BlockType } from '@formsmithapp/engine'
import * as Dialog from '@radix-ui/react-dialog'
import { Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BlockIconTile } from './block-icons'
import { useBuilder, useBuilderState } from './store-context'

/** Picker grouping, in display order (design §9; date files under Number & date). */
const GROUPS: { label: string; category: string }[] = [
  { label: 'Text', category: 'text' },
  { label: 'Choice', category: 'choice' },
  { label: 'Contact', category: 'contact' },
  { label: 'Number & date', category: 'number' },
  { label: 'Rating', category: 'rating' },
  { label: 'Screens', category: 'screen' },
  { label: '✦ Formsmith AI', category: 'ai' },
]

export function Palette() {
  const store = useBuilder()
  const state = useBuilderState()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const hasWelcome = state.doc.blocks.some((b) => b.type === 'welcome')

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = (d: BlockDefinition) =>
      q === '' || d.displayName.toLowerCase().includes(q) || d.type.includes(q)
    return GROUPS.flatMap((group) => {
      const items = v1BlockDefinitions.filter((d) => d.category === group.category && matches(d))
      return items.length > 0 ? [{ group, items }] : []
    })
  }, [query])

  const flat = useMemo(
    () =>
      entries.flatMap(({ items }) =>
        items.map((d) => ({ definition: d, disabled: d.type === 'welcome' && hasWelcome })),
      ),
    [entries, hasWelcome],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies(query): reset the cursor whenever the filter changes
  useEffect(() => setActive(0), [query])

  const insert = (type: string) => {
    const id = store.insertBlock(type as BlockType)
    if (id !== null) {
      store.setPaletteOpen(false)
      setQuery('')
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    const enabled = flat.filter((e) => !e.disabled)
    if (enabled.length === 0) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + delta + enabled.length) % enabled.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const target = enabled[active]
      if (target !== undefined) insert(target.definition.type)
    }
  }

  let enabledIndex = -1
  return (
    <Dialog.Root open={state.paletteOpen} onOpenChange={(open) => store.setPaletteOpen(open)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px]" />
        <Dialog.Content
          onKeyDown={onKeyDown}
          className="fixed top-[14vh] left-1/2 z-50 w-[min(680px,92vw)] -translate-x-1/2 overflow-hidden rounded-[16px] border border-line bg-surface-2 shadow-lg"
        >
          <Dialog.Title className="sr-only">Add a block</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-line-soft px-4 py-3">
            <Search size={15} className="text-fg-3" aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search blocks…"
              aria-label="Search blocks"
              className="flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-fg-3"
            />
            <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] text-fg-3">
              Esc
            </kbd>
          </div>
          <div className="max-h-[52vh] overflow-y-auto p-3">
            {entries.map(({ group, items }) => (
              <section key={group.category} className="mb-3">
                <h3
                  className={`eyebrow px-1.5 pb-1.5 ${group.category === 'ai' ? 'text-brand' : 'text-fg-3'}`}
                >
                  {group.label}
                </h3>
                <div className="grid grid-cols-2 gap-1.5 max-[560px]:grid-cols-1">
                  {items.map((definition) => {
                    const disabled = definition.type === 'welcome' && hasWelcome
                    if (!disabled) enabledIndex += 1
                    const isActive = !disabled && enabledIndex === active
                    return (
                      <button
                        key={definition.type}
                        type="button"
                        disabled={disabled}
                        data-palette-item={definition.type}
                        onClick={() => insert(definition.type)}
                        onMouseEnter={
                          disabled
                            ? undefined
                            : (() => {
                                const snapshot = enabledIndex
                                return () => setActive(snapshot)
                              })()
                        }
                        className={`flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2 text-left transition-colors ${
                          isActive ? 'border-brand/40 bg-brand-soft' : 'border-transparent'
                        } ${disabled ? 'cursor-not-allowed opacity-40' : 'hover:bg-surface-hover'}`}
                      >
                        <BlockIconTile
                          iconKey={definition.iconKey}
                          ai={definition.category === 'ai'}
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">
                            {definition.displayName}
                          </span>
                          <span className="block truncate text-[11px] text-fg-3">
                            {definition.description}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
            {flat.length === 0 && (
              <p className="px-1.5 py-6 text-center text-[13px] text-fg-3">No blocks match.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
