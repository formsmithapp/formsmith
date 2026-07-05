// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileText, Plus, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BrandMark } from '@/components/brand-mark'
import { ThemeToggle } from '@/components/theme-toggle'
import { getRepository } from '@/lib/repository/client'

export default function FormsListPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const forms = useQuery({ queryKey: ['forms'], queryFn: () => getRepository().list() })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['forms'] })

  const createForm = useMutation({
    mutationFn: () => getRepository().create(),
    onSuccess: (stored) => {
      invalidate()
      router.push(`/forms/${stored.form.id}/create`)
    },
  })
  const duplicateForm = useMutation({
    mutationFn: (id: string) => getRepository().duplicate(id),
    onSuccess: invalidate,
  })
  const removeForm = useMutation({
    mutationFn: (id: string) => getRepository().remove(id),
    onSuccess: invalidate,
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <BrandMark />
        <ThemeToggle />
      </header>

      <div className="mt-12 flex items-end justify-between">
        <div>
          <p className="eyebrow text-brand">Workspace</p>
          <h1 className="mt-2 font-serif text-[32px] font-semibold tracking-[-0.012em]">
            Your forms
          </h1>
        </div>
        <button
          type="button"
          onClick={() => createForm.mutate()}
          className="flex items-center gap-2 rounded-[9px] bg-brand px-4 py-2 text-[14px] font-semibold text-on-brand shadow-sm transition-transform duration-100 ease-spring hover:bg-brand-strong active:scale-95"
        >
          <Plus size={15} /> New form
        </button>
      </div>

      <ul className="mt-8 space-y-2.5">
        {(forms.data ?? []).map((summary) => (
          <li
            key={summary.id}
            className="group flex items-center gap-4 rounded-[12px] border border-line bg-surface-2 px-4 py-3.5 shadow-sm transition-colors hover:border-brand/30"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-brand-soft text-brand">
              <FileText size={15} />
            </span>
            <button
              type="button"
              className="min-w-0 flex-1 cursor-pointer text-left"
              onClick={() => router.push(`/forms/${summary.id}/create`)}
            >
              <span className="block truncate text-[14px] font-semibold">{summary.title}</span>
              <span className="mt-0.5 block font-mono text-[10.5px] tracking-[0.08em] text-fg-3 uppercase">
                {summary.blockCount} blocks
                {summary.status === 'published'
                  ? ` · v${summary.publishedVersion} live`
                  : ' · draft'}
              </span>
            </button>
            {summary.status === 'published' && (
              <span className="rounded-full border border-success/30 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.1em] text-success uppercase">
                Live
              </span>
            )}
            <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                aria-label={`Duplicate ${summary.title}`}
                onClick={() => duplicateForm.mutate(summary.id)}
                className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-fg"
              >
                <Copy size={14} />
              </button>
              <button
                type="button"
                aria-label={`Delete ${summary.title}`}
                onClick={() => removeForm.mutate(summary.id)}
                className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-error"
              >
                <Trash2 size={14} />
              </button>
            </span>
          </li>
        ))}
        {forms.isSuccess && forms.data.length === 0 && (
          <li className="rounded-[12px] border border-line border-dashed px-6 py-14 text-center">
            <p className="font-serif text-[19px] text-fg-2">No forms yet.</p>
            <p className="mt-1 text-[13px] text-fg-2">
              Create your first form — it lives in this browser for now.
            </p>
          </li>
        )}
      </ul>
    </div>
  )
}
