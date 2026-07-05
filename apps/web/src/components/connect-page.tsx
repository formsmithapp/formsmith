// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { FormDefinition } from '@formsmithapp/engine'
import * as Switch from '@radix-ui/react-switch'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, Copy, Loader2, Plus, Send, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getRepository } from '@/lib/repository/client'
import { TabHeader } from './tab-header'

/**
 * The Connect tab — form-level integrations: signed webhooks (with delivery
 * history from v1 onwards) and the owner-notification toggle. API keys are
 * workspace-level and live at /settings/api-keys.
 */

interface Delivery {
  id: string
  event: string
  attempt: number
  status: number | null
  error: string | null
  durationMs: number
  createdAt: string
}

interface Webhook {
  id: string
  url: string
  active: boolean
  lastStatus: number | null
  lastError: string | null
  lastAttemptAt: string | null
  createdAt: string
  deliveries: Delivery[]
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function StatusDot({ status }: { status: number | null }) {
  const tone =
    status === null ? 'bg-line' : status >= 200 && status < 300 ? 'bg-success' : 'bg-error'
  return <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tone}`} />
}

function SecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-6">
      <div className="w-full max-w-md rounded-[16px] border border-line bg-surface-2 p-6 shadow-lg">
        <p className="eyebrow text-brand">Webhook created</p>
        <h2 className="mt-2 font-serif text-[20px] font-semibold">Copy the signing secret</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-fg-2">
          Verify every delivery's <code className="font-mono">X-Formsmith-Signature</code> with it.
          Shown once.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <code
            data-webhook-secret
            className="min-w-0 flex-1 truncate rounded-[10px] border border-line bg-surface px-3 py-2.5 font-mono text-[12px]"
          >
            {secret}
          </code>
          <button
            type="button"
            aria-label="Copy signing secret"
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

function WebhookRow({ formId, hook }: { formId: string; hook: Webhook }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['webhooks', formId] })

  const remove = useMutation({
    mutationFn: () => fetch(`/api/v1/forms/${formId}/webhooks/${hook.id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  })
  const test = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/forms/${formId}/webhooks/${hook.id}/test`, {
        method: 'POST',
      })
      if (res.status !== 202) throw new Error('test fire failed')
    },
  })

  return (
    <li className="rounded-[12px] border border-line bg-surface-2 shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusDot status={hook.lastStatus} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-mono text-[12.5px]">{hook.url}</span>
          <span className="mt-0.5 block text-[11px] text-fg-3">
            {hook.lastAttemptAt === null
              ? 'no deliveries yet'
              : `last: ${hook.lastStatus ?? 'failed'} · ${when(hook.lastAttemptAt)}`}
            {hook.lastError !== null && <span className="text-error"> · {hook.lastError}</span>}
          </span>
        </span>
        <button
          type="button"
          onClick={() => test.mutate()}
          disabled={test.isPending}
          className="flex shrink-0 items-center gap-1.5 rounded-[8px] border border-line px-2.5 py-1 text-[12px] font-semibold text-fg-2 hover:text-fg disabled:opacity-60"
        >
          {test.isPending ? (
            <Loader2 size={11} className="animate-spin" aria-hidden="true" />
          ) : (
            <Send size={11} aria-hidden="true" />
          )}
          {test.isSuccess ? 'Sent' : 'Send test'}
        </button>
        <button
          type="button"
          aria-label="Delete webhook"
          onClick={() => remove.mutate()}
          className="grid size-7 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-surface-hover hover:text-error"
        >
          <Trash2 size={13} />
        </button>
        <button
          type="button"
          aria-label="Delivery history"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="grid size-7 shrink-0 place-items-center rounded-md text-fg-3 hover:bg-surface-hover"
        >
          <ChevronDown size={14} className={open ? 'rotate-180' : ''} />
        </button>
      </div>
      {open && (
        <div className="border-t border-line-soft px-4 py-3">
          {hook.deliveries.length === 0 ? (
            <p className="text-[12px] text-fg-3">No delivery attempts recorded yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {hook.deliveries.map((delivery) => (
                <li key={delivery.id} className="flex items-center gap-2.5 font-mono text-[11.5px]">
                  <StatusDot status={delivery.status} />
                  <span className="w-32 shrink-0">{delivery.event}</span>
                  <span className="w-20 shrink-0">
                    {delivery.status ?? 'failed'} · #{delivery.attempt}
                  </span>
                  <span className="w-16 shrink-0 text-fg-3">{delivery.durationMs}ms</span>
                  <span className="min-w-0 flex-1 truncate text-fg-3">
                    {delivery.error ?? when(delivery.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  )
}

export function ConnectPage({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const stored = useQuery({ queryKey: ['form', id], queryFn: () => getRepository().get(id) })
  const webhooks = useQuery({
    queryKey: ['webhooks', id],
    queryFn: async (): Promise<Webhook[]> => {
      const res = await fetch(`/api/v1/forms/${id}/webhooks`)
      if (!res.ok) throw new Error('failed to load webhooks')
      return ((await res.json()) as { webhooks: Webhook[] }).webhooks
    },
  })
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: async () =>
      (await (await fetch('/api/v1/meta')).json()) as { mailConfigured: boolean },
    staleTime: 300_000,
  })

  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState<string | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  const addWebhook = useMutation({
    mutationFn: async (hookUrl: string) => {
      const res = await fetch(`/api/v1/forms/${id}/webhooks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: hookUrl }),
      })
      if (res.status === 400) throw new Error('https URLs only (http is fine for localhost)')
      if (res.status !== 201) throw new Error('failed to add webhook')
      return (await res.json()) as { secret: string }
    },
    onSuccess: (data) => {
      setUrl('')
      setUrlError(null)
      setSecret(data.secret)
      queryClient.invalidateQueries({ queryKey: ['webhooks', id] })
    },
    onError: (error) => setUrlError(error.message),
  })

  const notifyOnSubmit =
    (stored.data?.form.settings as { notifyOnSubmit?: boolean } | undefined)?.notifyOnSubmit ===
    true
  const toggleNotify = useMutation({
    // fetch fresh inside the mutation — clicking before the page query
    // settles must not silently no-op
    mutationFn: async (on: boolean) => {
      const current = await getRepository().get(id)
      if (current === null) throw new Error('form not found')
      const form = current.form as FormDefinition
      await getRepository().save(id, {
        ...form,
        settings: { ...form.settings, notifyOnSubmit: on } as FormDefinition['settings'],
      })
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['form', id] }),
  })

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TabHeader formId={id} title={stored.data?.form.title ?? ''} active="connect" />
      <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-10">
        <p className="eyebrow text-brand">Connect</p>
        <h1 className="mt-2 font-serif text-[26px] font-semibold tracking-[-0.012em]">
          Webhooks &amp; notifications
        </h1>

        <section className="mt-8">
          <h2 className="eyebrow text-fg-3">Webhooks</h2>
          <p className="mt-2 max-w-[54ch] text-[13px] leading-relaxed text-fg-2">
            Every accepted response POSTs a signed payload to your endpoint — verify the{' '}
            <code className="font-mono">X-Formsmith-Signature</code> header with the signing secret.
            Retries with backoff on failure.
          </p>
          <form
            className="mt-4 flex items-start gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              if (url.trim() !== '') addWebhook.mutate(url.trim())
            }}
          >
            <div className="min-w-0 flex-1">
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                aria-label="Webhook URL"
                placeholder="https://example.com/hooks/formsmith"
                className="w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 font-mono text-[12.5px] outline-none focus:border-brand-ring"
              />
              {urlError !== null && <p className="mt-1 text-[11.5px] text-error">{urlError}</p>}
            </div>
            <button
              type="submit"
              disabled={addWebhook.isPending || url.trim() === ''}
              className="flex shrink-0 items-center gap-1.5 rounded-[9px] bg-brand px-3.5 py-2 text-[13px] font-semibold text-on-brand shadow-sm disabled:opacity-60"
            >
              <Plus size={13} aria-hidden="true" /> Add webhook
            </button>
          </form>
          <ul className="mt-4 space-y-2.5">
            {(webhooks.data ?? []).map((hook) => (
              <WebhookRow key={hook.id} formId={id} hook={hook} />
            ))}
            {webhooks.isSuccess && webhooks.data.length === 0 && (
              <li className="rounded-[12px] border border-line border-dashed px-6 py-8 text-center text-[13px] text-fg-2">
                No webhooks yet.
              </li>
            )}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="eyebrow text-fg-3">Notifications</h2>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-3.5 shadow-sm">
            <span>
              <span className="block text-[13.5px] font-medium">Email me on every response</span>
              <span className="block text-[11.5px] text-fg-3">
                {meta.data?.mailConfigured === true
                  ? 'Sent to the workspace owner.'
                  : 'Set SMTP_URL and EMAIL_FROM on the server to enable delivery.'}
              </span>
            </span>
            <Switch.Root
              checked={notifyOnSubmit}
              onCheckedChange={(v) => toggleNotify.mutate(v)}
              aria-label="Email me on every response"
              className="relative h-[20px] w-[34px] shrink-0 rounded-full bg-line transition-colors data-[state=checked]:bg-brand"
            >
              <Switch.Thumb className="block size-[16px] translate-x-[2px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-spring data-[state=checked]:translate-x-[16px]" />
            </Switch.Root>
          </div>
        </section>

        <section className="mt-10 rounded-[12px] border border-line-soft bg-surface px-4 py-3.5">
          <h2 className="eyebrow text-fg-3">Use the API</h2>
          <pre className="mt-2 overflow-x-auto font-mono text-[11.5px] leading-relaxed text-fg-2">
            {`curl -H "Authorization: Bearer fsk_..." \\\n  ${origin}/api/v1/forms/${id}/responses`}
          </pre>
          <p className="mt-2 text-[11.5px] text-fg-3">
            Manage keys in{' '}
            <Link href="/settings/api-keys" className="font-semibold text-brand">
              workspace settings
            </Link>{' '}
            · spec at{' '}
            <a href="/api/v1/openapi.json" className="font-semibold text-brand">
              /api/v1/openapi.json
            </a>
          </p>
        </section>
      </div>
      {secret !== null && <SecretModal secret={secret} onClose={() => setSecret(null)} />}
    </div>
  )
}
