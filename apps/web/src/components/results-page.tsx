// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { FormDefinition } from '@formsmithapp/engine'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Inbox, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { getRepository, getResponsesRepository } from '@/lib/repository/client'
import type { StoredResponse } from '@/lib/repository/responses'
import {
  formatAnswer,
  isAnswered,
  type QuestionSummary,
  summarize,
  toCsv,
  toJson,
} from '@/lib/results'
import { TabHeader } from './tab-header'

const SCREEN_TYPES = new Set(['welcome', 'statement', 'thankyou'])

function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/* ---------- summary view ---------- */

function Bar({ count, total }: { count: number; total: number }) {
  return (
    <span className="relative h-[7px] flex-1 overflow-hidden rounded-full bg-brand-soft">
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-brand"
        style={{ width: total > 0 ? `${(count / total) * 100}%` : 0 }}
      />
    </span>
  )
}

function SummaryCard({ summary, index }: { summary: QuestionSummary; index: number }) {
  return (
    <section className="rounded-[14px] border border-line bg-surface-2 p-5 shadow-sm">
      <p className="eyebrow flex items-center justify-between text-fg-3">
        <span className="text-brand">Question {index + 1}</span>
        <span>
          {summary.answered} answer{summary.answered === 1 ? '' : 's'}
        </span>
      </p>
      <h3 className="mt-2 font-serif text-[18px] font-semibold [text-wrap:balance]">
        {summary.block.title}
      </h3>

      {summary.kind === 'choices' && (
        <ul className="mt-4 space-y-2.5">
          {summary.options.map((option) => (
            <li key={option.label} className="flex items-center gap-3 text-[13px]">
              <span className="w-32 truncate">{option.label}</span>
              <Bar count={option.count} total={summary.answered} />
              <span className="w-8 text-right font-mono text-[12px] tabular-nums">
                {option.count}
              </span>
            </li>
          ))}
        </ul>
      )}

      {summary.kind === 'numeric' && (
        <div className="mt-4">
          <p className="flex items-baseline gap-3">
            <span className="font-serif text-[30px] font-semibold tabular-nums">
              {summary.answered > 0 ? (Math.round(summary.average * 10) / 10).toString() : '—'}
            </span>
            <span className="text-[12px] text-fg-2">
              average{summary.answered > 0 ? ` · min ${summary.min} · max ${summary.max}` : ''}
            </span>
          </p>
          {summary.histogram.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {summary.histogram.map((bucket) => (
                <li key={bucket.value} className="flex items-center gap-3 text-[12px]">
                  <span className="w-8 text-right font-mono tabular-nums">{bucket.value}</span>
                  <Bar count={bucket.count} total={summary.answered} />
                  <span className="w-8 text-right font-mono text-[12px] tabular-nums">
                    {bucket.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {summary.kind === 'texts' &&
        (summary.latest.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {summary.latest.map((entry) => (
              <li
                key={`${entry.submittedAt}-${entry.text}`}
                className="rounded-[10px] bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed"
              >
                “{entry.text}”
                <span className="mt-1 block font-mono text-[10px] text-fg-3">
                  {when(entry.submittedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[12.5px] text-fg-3">No answers yet.</p>
        ))}
    </section>
  )
}

/* ---------- responses view ---------- */

function ResponseDetail({
  formId,
  response,
  onDeleted,
}: {
  formId: string
  response: StoredResponse
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  // the PINNED snapshot: answers render against the version they were collected under
  const pinned = useQuery({
    queryKey: ['snapshot', formId, response.formVersion],
    queryFn: () => getRepository().getSnapshot(formId, response.formVersion),
  })
  const removeResponse = useMutation({
    mutationFn: () => getResponsesRepository().remove(formId, response.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responses', formId] })
      onDeleted()
    },
  })
  const blocks = (pinned.data?.blocks ?? []).filter((block) => !SCREEN_TYPES.has(block.type))
  const variables = Object.entries(response.variables)
  const hidden = Object.entries(response.hidden)

  return (
    <div className="rounded-[14px] border border-line bg-surface-2 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="eyebrow text-fg-3">
          {when(response.submittedAt)} · v{response.formVersion}
        </p>
        <button
          type="button"
          aria-label="Delete response"
          onClick={() => removeResponse.mutate()}
          className="grid size-7 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-error"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <dl className="mt-4 space-y-4">
        {blocks.map((block) => {
          const value = response.answers[block.ref]
          return (
            <div key={block.id}>
              <dt className="text-[12px] font-medium text-fg-2">
                {block.title !== '' ? block.title : block.ref}
              </dt>
              <dd className="mt-1 text-[14px]">
                {isAnswered(value) ? (
                  formatAnswer(block, value)
                ) : (
                  <span className="text-fg-3">—</span>
                )}
              </dd>
            </div>
          )
        })}
      </dl>
      {(variables.length > 0 || hidden.length > 0) && (
        <div className="mt-5 border-t border-line-soft pt-3.5 font-mono text-[11.5px] text-fg-2">
          {variables.map(([name, value]) => (
            <p key={name}>
              Σ {name} = {String(value)}
            </p>
          ))}
          {hidden.map(([name, value]) => (
            <p key={name}>
              # {name} = {value}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- the tab ---------- */

export function ResultsView({ formId, snapshot }: { formId: string; snapshot: FormDefinition }) {
  const [view, setView] = useState<'summary' | 'responses'>('summary')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const responses = useQuery({
    queryKey: ['responses', formId],
    queryFn: () => getResponsesRepository().list(formId),
  })
  const all = responses.data ?? []
  const selected = all.find((response) => response.id === selectedId) ?? all[0] ?? null

  if (responses.isSuccess && all.length === 0) {
    return (
      <div className="grid flex-1 place-items-center px-6">
        <div className="max-w-sm text-center">
          <Inbox size={22} className="mx-auto text-fg-3" aria-hidden="true" />
          <h2 className="mt-4 font-serif text-[22px] font-semibold">No responses yet</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
            Share the live link — every completed response lands here.
          </p>
          <Link
            href={`/f/${formId}`}
            className="mt-5 inline-block rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-sm"
          >
            Open the live form
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-[10px] bg-surface-hover p-0.5">
          {(['summary', 'responses'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`rounded-[8px] px-3.5 py-1.5 text-[13px] capitalize transition-colors ${
                view === key ? 'bg-surface-2 font-semibold shadow-sm' : 'font-medium text-fg-2'
              }`}
            >
              {key}
              {key === 'responses' && (
                <span className="ml-1.5 font-mono text-[11px] text-fg-3">{all.length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => download(`${formId}-responses.csv`, 'text/csv', toCsv(snapshot, all))}
            className="flex items-center gap-1.5 rounded-[9px] border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold shadow-sm"
          >
            <Download size={12} /> CSV
          </button>
          <button
            type="button"
            onClick={() => download(`${formId}-responses.json`, 'application/json', toJson(all))}
            className="flex items-center gap-1.5 rounded-[9px] border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold shadow-sm"
          >
            <Download size={12} /> JSON
          </button>
        </div>
      </div>

      {view === 'summary' ? (
        <div className="mt-6 space-y-4">
          {summarize(snapshot, all).map((summary, index) => (
            <SummaryCard key={summary.block.ref} summary={summary} index={index} />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-[260px_1fr]">
          <ul className="space-y-1.5">
            {all.map((response) => (
              <li key={response.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(response.id)}
                  aria-current={selected?.id === response.id}
                  className={`w-full rounded-[10px] border px-3 py-2.5 text-left transition-colors ${
                    selected?.id === response.id
                      ? 'border-brand-ring bg-surface-2 shadow-sm'
                      : 'border-line hover:bg-surface-hover'
                  }`}
                >
                  <span className="block truncate text-[13px] font-medium">
                    {firstAnswerExcerpt(snapshot, response)}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10px] text-fg-3">
                    {when(response.submittedAt)} · v{response.formVersion}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {selected !== null && (
            <ResponseDetail
              formId={formId}
              response={selected}
              onDeleted={() => setSelectedId(null)}
            />
          )}
        </div>
      )}
    </div>
  )
}

function firstAnswerExcerpt(snapshot: FormDefinition, response: StoredResponse): string {
  for (const block of snapshot.blocks) {
    if (SCREEN_TYPES.has(block.type)) continue
    const value = response.answers[block.ref]
    if (isAnswered(value)) return formatAnswer(block, value)
  }
  return 'No answers'
}

/** The Results tab route body: header + latest snapshot + the view. */
export function ResultsPage({ id }: { id: string }) {
  const stored = useQuery({ queryKey: ['form', id], queryFn: () => getRepository().get(id) })
  const version = stored.data?.publishedVersion
  const snapshot = useQuery({
    queryKey: ['snapshot', id, version],
    queryFn: () => (version === undefined ? null : getRepository().getSnapshot(id, version)),
    enabled: stored.isSuccess,
  })

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TabHeader formId={id} title={stored.data?.form.title ?? ''} active="results" />
      {stored.isSuccess &&
        (version === undefined || (snapshot.isSuccess && snapshot.data === null) ? (
          <div className="grid flex-1 place-items-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="font-serif text-[22px] font-semibold">Publish first</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
                Results collect against published versions. Publish the form, then share its live
                link.
              </p>
              <Link
                href={`/forms/${id}/create`}
                className="mt-5 inline-block rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-sm"
              >
                Back to Create
              </Link>
            </div>
          </div>
        ) : (
          snapshot.data != null && <ResultsView formId={id} snapshot={snapshot.data} />
        ))}
    </div>
  )
}
