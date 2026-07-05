// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import Link from 'next/link'
import { BrandMark } from './brand-mark'
import { ThemeToggle } from './theme-toggle'

const TABS = [
  { key: 'create', label: 'Create' },
  { key: 'connect', label: 'Connect' },
  { key: 'share', label: 'Share' },
  { key: 'results', label: 'Results' },
] as const

/** The workflow header for the non-builder tabs (Share/Results/Connect). */
export function TabHeader({
  formId,
  title,
  active,
}: {
  formId: string
  title: string
  active: (typeof TABS)[number]['key']
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line bg-surface px-4">
      <Link href="/" aria-label="Back to your forms" className="shrink-0">
        <BrandMark wordmark={false} />
      </Link>
      <span aria-hidden="true" className="h-5 w-px bg-line" />
      <span className="w-44 truncate px-2 text-[14px] font-semibold">{title}</span>

      <nav
        aria-label="Workflow"
        className="mx-auto flex items-center gap-0.5 rounded-[10px] bg-surface-hover p-0.5 max-[720px]:hidden"
      >
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={`/forms/${formId}/${tab.key}`}
            aria-current={tab.key === active ? 'page' : undefined}
            className={`flex items-center gap-1.5 rounded-[8px] px-3.5 py-1.5 text-[13px] transition-colors ${
              tab.key === active
                ? 'bg-surface-2 font-semibold shadow-sm'
                : 'font-medium text-fg-2 hover:text-fg'
            }`}
          >
            {tab.key === active && (
              <span aria-hidden="true" className="size-1.5 rounded-full bg-brand" />
            )}
            {tab.label}
          </Link>
        ))}
      </nav>

      <ThemeToggle />
    </header>
  )
}
