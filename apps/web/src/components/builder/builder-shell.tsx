// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './canvas'
import { Palette } from './palette'
import { Panel } from './panel'
import { PreviewOverlay } from './preview-overlay'
import { Rail } from './rail'
import { useBuilder, useBuilderState } from './store-context'
import { TopBar } from './top-bar'

export interface ToastState {
  id: number
  message: string
  tone: 'default' | 'error'
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable)
  )
}

export function BuilderShell() {
  const store = useBuilder()
  const state = useBuilderState()
  const [toast, setToast] = useState<ToastState | null>(null)

  const showToast = useCallback((message: string, tone: 'default' | 'error' = 'default') => {
    setToast({ id: Date.now(), message, tone })
  }, [])

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 2_100)
    return () => clearTimeout(timer)
  }, [toast])

  // Global builder keys: ⌘K palette · j/k walk blocks · ⌘Z/⌘⇧Z history · Esc closes.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey
      const snapshot = store.getState()
      if (meta && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        store.setPaletteOpen(!snapshot.paletteOpen)
        return
      }
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) store.redo()
        else store.undo()
        return
      }
      if (event.key === 'Escape') {
        if (snapshot.previewMode) store.setPreviewMode(false)
        return
      }
      if (isTypingTarget(event.target) || snapshot.previewMode || snapshot.paletteOpen) return
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault()
        const blocks = snapshot.doc.blocks
        const index = blocks.findIndex((b) => b.id === snapshot.selectedId)
        const next = blocks[index + (event.key === 'j' ? 1 : -1)]
        if (next !== undefined) store.select(next.id)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [store])

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <a
        href="#builder-canvas"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[70] focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-[13px] focus:text-[#f4f3ec]"
      >
        Skip to canvas
      </a>
      <TopBar onToast={showToast} />
      <div
        inert={state.previewMode || undefined}
        className="grid min-h-0 flex-1 grid-cols-[272px_minmax(0,1fr)_320px] max-[1180px]:grid-cols-[248px_minmax(0,1fr)_288px] max-[860px]:grid-cols-[248px_minmax(0,1fr)]"
      >
        <Rail />
        <Canvas />
        <div className="min-h-0 max-[860px]:hidden">
          <Panel onToast={showToast} />
        </div>
      </div>
      <Palette />
      {state.previewMode && <PreviewOverlay onToast={showToast} />}
      {toast !== null && (
        <output
          key={toast.id}
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-[11px] px-4 py-2.5 text-[13px] font-medium shadow-lg dark:bg-surface-2 dark:text-fg ${
            toast.tone === 'error' ? 'bg-error text-white' : 'bg-ink text-[#f4f3ec]'
          }`}
        >
          {toast.message}
        </output>
      )}
    </div>
  )
}
