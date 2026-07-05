// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { Check, Eye, Loader2, Pencil } from 'lucide-react'
import Link from 'next/link'
import { PublishValidationError } from '@/lib/repository/types'
import { BrandMark } from '../brand-mark'
import { ThemeToggle } from '../theme-toggle'
import { SettingsSheet } from './settings-sheet'
import { useBuilder, useBuilderState } from './store-context'

const TABS = [
  { key: 'create', label: 'Create' },
  { key: 'connect', label: 'Connect' },
  { key: 'share', label: 'Share' },
  { key: 'results', label: 'Results' },
] as const

export function TopBar({
  onToast,
}: {
  onToast: (message: string, tone?: 'default' | 'error') => void
}) {
  const store = useBuilder()
  const state = useBuilderState()

  const publish = async () => {
    try {
      const { version } = await store.publish()
      onToast(`Published v${version} — snapshot saved`)
    } catch (error) {
      if (error instanceof PublishValidationError) {
        const [first] = error.issues
        const more = error.issues.length - 1
        onToast(`Can't publish: ${first}${more > 0 ? ` (+${more} more)` : ''}`, 'error')
      } else {
        onToast('Publish failed', 'error')
      }
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
      <Link href="/" aria-label="Back to your forms" className="shrink-0">
        <BrandMark wordmark={false} />
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-line" />
      <div className="group relative flex min-w-0 items-center gap-1.5">
        <input
          value={state.doc.title ?? ''}
          onChange={(event) => store.updateFormTitle(event.target.value)}
          aria-label="Form name"
          className="w-44 truncate rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] font-semibold transition-colors hover:bg-surface-hover focus:border-line focus:bg-surface-2 focus:shadow-sm focus:outline-none"
        />
        <Pencil
          size={11}
          className="shrink-0 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>

      <nav
        aria-label="Workflow"
        className="mx-auto flex items-center gap-0.5 rounded-[10px] bg-surface-hover p-0.5 max-[720px]:hidden"
      >
        {TABS.map((tab) => {
          const active = tab.key === 'create'
          return (
            <Link
              key={tab.key}
              href={`/forms/${state.doc.id}/${tab.key}`}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13px] transition-colors ${
                active
                  ? 'bg-surface-2 font-semibold shadow-sm'
                  : 'font-medium text-fg-2 hover:text-fg'
              }`}
            >
              {active && <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />}
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <output
        aria-live="polite"
        className="flex w-20 items-center justify-end gap-1.5 text-[12px] text-fg-2"
      >
        {state.saveState === 'saving' && (
          <>
            <Loader2 size={12} className="animate-spin text-brand" aria-hidden="true" /> Saving…
          </>
        )}
        {state.saveState === 'saved' && (
          <>
            <Check size={12} className="text-success" aria-hidden="true" /> Saved
          </>
        )}
      </output>

      <SettingsSheet />
      <ThemeToggle />
      <button
        type="button"
        onClick={() => store.setPreviewMode(true)}
        className="flex items-center gap-1.5 rounded-[9px] border border-line bg-surface-2 px-3.5 py-1.5 text-[13px] font-semibold shadow-sm transition-transform duration-100 ease-spring active:scale-95"
      >
        <Eye size={13} /> Preview
      </button>
      {/* the one amber button on the screen */}
      <button
        type="button"
        onClick={publish}
        className="rounded-[9px] bg-accent px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition-transform duration-100 ease-spring hover:bg-accent-strong active:scale-95 dark:text-ink"
      >
        Publish
      </button>
    </header>
  )
}
