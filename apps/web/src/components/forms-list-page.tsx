// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { FormDefinition } from '@formsmithapp/engine'
import { instantiateTemplate, TEMPLATES, type TemplateDefinition } from '@formsmithapp/templates'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, FileText, Loader2, Plus, Settings, Sparkles, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BrandMark } from '@/components/brand-mark'
import { ImportBanner } from '@/components/import-banner'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'
import { getRepository } from '@/lib/repository/client'

/** Turn the API's terse error codes into a friendly line for the AI prompt box. */
function friendlyGenerateError(status: number, body: { error?: string; resource?: string } | null) {
  if (status === 403 && body?.error === 'ai_credits_exhausted') {
    return "You're out of AI credits, so generation is paused. Your existing forms keep working."
  }
  if (status === 403 && body?.error === 'quota_exceeded' && body.resource === 'forms') {
    return "You've reached the form limit for this workspace."
  }
  if (status === 503) return "AI isn't configured on this instance."
  return body?.error ?? `generation failed (${status})`
}

export function FormsListPage() {
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
  const createFromTemplate = useMutation({
    mutationFn: (template: TemplateDefinition) =>
      getRepository().create(instantiateTemplate(template)),
    onSuccess: (stored) => {
      invalidate()
      router.push(`/forms/${stored.form.id}/create`)
    },
  })

  // AI form generation — visible only when the instance has a provider
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: async () => (await (await fetch('/api/v1/meta')).json()) as { aiConfigured: boolean },
    staleTime: 300_000,
  })
  const [aiPrompt, setAiPrompt] = useState('')
  const generate = useMutation({
    mutationFn: async (prompt: string) => {
      const res = await fetch('/api/v1/forms/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (res.status !== 201) {
        const body = (await res.json().catch(() => null)) as {
          error?: string
          resource?: string
        } | null
        throw new Error(friendlyGenerateError(res.status, body))
      }
      return (await res.json()) as { form: FormDefinition }
    },
    onSuccess: ({ form }) => {
      invalidate()
      router.push(`/forms/${form.id}/create`)
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
        <span className="flex items-center gap-3">
          <UserMenu />
          <Link
            href="/settings/api-keys"
            aria-label="Workspace settings"
            className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-hover hover:text-fg"
          >
            <Settings size={14} />
          </Link>
          <ThemeToggle />
        </span>
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

      <ImportBanner />

      {meta.data?.aiConfigured === true && (
        <section className="mt-8">
          <h2 className="eyebrow text-fg-3">Start with AI</h2>
          <form
            className="mt-3 flex items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (aiPrompt.trim().length >= 3) generate.mutate(aiPrompt.trim())
            }}
          >
            <div className="min-w-0 flex-1">
              <input
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                aria-label="Describe your form"
                placeholder="Describe your form — e.g. customer discovery interview for a budgeting app"
                className="w-full rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5 text-[13.5px] shadow-sm outline-none focus:border-brand-ring"
              />
              {generate.isError && (
                <p className="mt-1 text-[11.5px] text-error">{generate.error.message}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={generate.isPending || aiPrompt.trim().length < 3}
              className="flex shrink-0 items-center gap-1.5 rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-on-brand shadow-sm disabled:opacity-60"
            >
              {generate.isPending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 size={14} aria-hidden="true" />
              )}
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          </form>
          <p className="mt-1.5 text-[11.5px] text-fg-3">
            You get a draft to review in the builder — nothing publishes on its own.
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="eyebrow text-fg-3">Start from a template</h2>
        <ul className="mt-3 grid grid-cols-3 gap-2.5 max-[640px]:grid-cols-2">
          {TEMPLATES.map((template) => (
            <li key={template.id}>
              <button
                type="button"
                onClick={() => createFromTemplate.mutate(template)}
                className={`group/tpl h-full w-full rounded-[12px] border bg-surface-2 px-3.5 py-3 text-left shadow-sm transition-colors ${
                  template.featured === true
                    ? 'border-brand/40 hover:border-brand'
                    : 'border-line hover:border-brand/30'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: template.accent }}
                  />
                  <span className="min-w-0 truncate text-[13px] font-semibold">
                    {template.name}
                  </span>
                  {template.featured === true && (
                    <Sparkles size={11} className="shrink-0 text-brand" aria-hidden="true" />
                  )}
                </span>
                <span className="mt-1.5 block text-[11.5px] leading-snug text-fg-2">
                  {template.description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

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
              Create your first form — blank or from a template above.
            </p>
          </li>
        )}
      </ul>
    </div>
  )
}
