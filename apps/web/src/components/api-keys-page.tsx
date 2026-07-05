// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { BrandMark } from './brand-mark'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

/**
 * Workspace settings → API keys. Secrets are shown EXACTLY ONCE at creation;
 * the list shows prefixes and per-key usage (requests/day, last 30 days) —
 * recording started in v1, so every future chart inherits this history.
 */

interface ApiKey {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
  usage: { day: string; requests: number }[]
  total: number
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })

function UsageBars({ usage, total }: { usage: ApiKey['usage']; total: number }) {
  // a fixed 30-day strip, zero-filled — shape stays stable as data arrives
  const byDay = new Map(usage.map((bucket) => [bucket.day, bucket.requests]))
  const days: { day: string; requests: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10)
    days.push({ day, requests: byDay.get(day) ?? 0 })
  }
  const max = Math.max(1, ...days.map((d) => d.requests))
  return (
    <div>
      <div className="flex h-8 items-end gap-[2px]" aria-hidden="true">
        {days.map((bucket) => (
          <span
            key={bucket.day}
            title={`${bucket.day}: ${bucket.requests}`}
            className={`w-[5px] rounded-t-[2px] ${bucket.requests > 0 ? 'bg-brand' : 'bg-line-soft'}`}
            style={{ height: `${Math.max(8, (bucket.requests / max) * 100)}%` }}
          />
        ))}
      </div>
      <p className="mt-1 font-mono text-[10px] text-fg-3" data-usage-total>
        {total} request{total === 1 ? '' : 's'} · 30 days
      </p>
    </div>
  )
}

function RevealModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-6">
      <div className="w-full max-w-md rounded-[16px] border border-line bg-surface-2 p-6 shadow-lg">
        <p className="eyebrow text-brand">API key created</p>
        <h2 className="mt-2 font-serif text-[20px] font-semibold">Copy it now</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
          This is the only time the full key is shown — only a hash is stored.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code
            data-secret
            className="min-w-0 flex-1 truncate rounded-[10px] border border-line bg-surface px-3 py-2.5 font-mono text-[12px]"
          >
            {secret}
          </code>
          <button
            type="button"
            aria-label="Copy API key"
            onClick={async () => {
              await navigator.clipboard.writeText(secret)
              setCopied(true)
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[12.5px] font-semibold shadow-sm"
          >
            {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-sm"
        >
          I saved it — close
        </button>
      </div>
    </div>
  )
}

export function ApiKeysPage() {
  const queryClient = useQueryClient()
  const keys = useQuery({
    queryKey: ['api-keys'],
    queryFn: async (): Promise<ApiKey[]> => {
      const res = await fetch('/api/v1/api-keys')
      if (!res.ok) throw new Error('failed to load keys')
      return ((await res.json()) as { keys: ApiKey[] }).keys
    },
  })
  const [name, setName] = useState('')
  const [revealed, setRevealed] = useState<string | null>(null)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['api-keys'] })

  const create = useMutation({
    mutationFn: async (keyName: string) => {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: keyName }),
      })
      if (res.status !== 201) throw new Error('create failed')
      return (await res.json()) as { secret: string }
    },
    onSuccess: (data) => {
      setName('')
      setRevealed(data.secret)
      invalidate()
    },
  })
  const revoke = useMutation({
    mutationFn: (id: string) => fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Back to your forms">
          <BrandMark />
        </Link>
        <span className="flex items-center gap-3">
          <UserMenu />
          <ThemeToggle />
        </span>
      </header>

      <div className="mt-12 grid grid-cols-[160px_1fr] gap-10 max-[640px]:grid-cols-1">
        {/* the settings nav — one entry today, built to grow */}
        <nav aria-label="Workspace settings">
          <p className="eyebrow text-fg-3">Workspace</p>
          <ul className="mt-3 space-y-1">
            <li>
              <span className="flex items-center gap-2 rounded-[8px] bg-surface-hover px-2.5 py-1.5 text-[13px] font-semibold">
                <KeyRound size={13} aria-hidden="true" /> API keys
              </span>
            </li>
          </ul>
        </nav>

        <div>
          <h1 className="font-serif text-[26px] font-semibold tracking-[-0.012em]">API keys</h1>
          <p className="mt-1.5 max-w-[52ch] text-[13.5px] leading-relaxed text-fg-2">
            Keys authenticate the REST API with{' '}
            <code className="font-mono">Authorization: Bearer</code> and act with this workspace's
            full access. The spec lives at{' '}
            <a href="/api/v1/openapi.json" className="font-semibold text-brand">
              /api/v1/openapi.json
            </a>
            .
          </p>

          <form
            className="mt-6 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (name.trim() !== '') create.mutate(name.trim())
            }}
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-label="New key name"
              placeholder="Key name (e.g. CI, n8n)"
              className="w-56 rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[13.5px] outline-none focus:border-brand-ring"
            />
            <button
              type="submit"
              disabled={create.isPending || name.trim() === ''}
              className="flex items-center gap-1.5 rounded-[9px] bg-brand px-3.5 py-2 text-[13px] font-semibold text-on-brand shadow-sm disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus size={13} aria-hidden="true" />
              )}
              Create key
            </button>
          </form>

          <ul className="mt-6 space-y-3">
            {(keys.data ?? []).map((key) => (
              <li
                key={key.id}
                className="rounded-[12px] border border-line bg-surface-2 px-4 py-3.5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{key.name}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-fg-3">
                      {key.prefix}… · created {when(key.createdAt)}
                      {key.lastUsedAt !== null && ` · last used ${when(key.lastUsedAt)}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Revoke ${key.name}`}
                    onClick={() => revoke.mutate(key.id)}
                    className="grid size-7 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-error"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="mt-3">
                  <UsageBars usage={key.usage} total={key.total} />
                </div>
              </li>
            ))}
            {keys.isSuccess && keys.data.length === 0 && (
              <li className="rounded-[12px] border border-line border-dashed px-6 py-10 text-center text-[13px] text-fg-2">
                No API keys yet — create one to use the REST API.
              </li>
            )}
          </ul>
        </div>
      </div>

      {revealed !== null && <RevealModal secret={revealed} onClose={() => setRevealed(null)} />}
    </div>
  )
}
