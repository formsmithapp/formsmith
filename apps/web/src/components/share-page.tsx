// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useQuery } from '@tanstack/react-query'
import { Check, Copy, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getRepository } from '@/lib/repository/client'
import { TabHeader } from './tab-header'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-[9px] border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold shadow-sm"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

/** The Share tab — the live link + an honest iframe snippet (SDK embed later). */
export function SharePage({ id }: { id: string }) {
  const stored = useQuery({ queryKey: ['form', id], queryFn: () => getRepository().get(id) })
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])

  const version = stored.data?.publishedVersion
  const liveUrl = `${origin}/f/${id}`
  const embedSnippet = `<iframe src="${liveUrl}" style="width:100%;height:600px;border:0;border-radius:12px" title="${stored.data?.form.title ?? 'Form'}" allow="clipboard-write"></iframe>`

  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TabHeader formId={id} title={stored.data?.form.title ?? ''} active="share" />
      {stored.isSuccess && (
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
          {version === undefined ? (
            <div className="mt-16 text-center">
              <h2 className="font-serif text-[22px] font-semibold">Nothing to share yet</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">
                Publish the form to mint its live link.
              </p>
              <Link
                href={`/forms/${id}/create`}
                className="mt-5 inline-block rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-sm"
              >
                Back to Create
              </Link>
            </div>
          ) : (
            <>
              <p className="eyebrow text-brand">Live · v{version}</p>
              <h1 className="mt-2 font-serif text-[26px] font-semibold tracking-[-0.012em]">
                Share your form
              </h1>
              <p className="mt-2 max-w-[52ch] text-[13.5px] leading-relaxed text-fg-2">
                The live link serves the published snapshot — draft edits stay private until you
                publish again. Until this workspace is connected to a server, the link works in this
                browser only.
              </p>

              <section className="mt-8">
                <h2 className="eyebrow text-fg-3">Link</h2>
                <div className="mt-2.5 flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[12.5px]">
                    {liveUrl}
                  </code>
                  <CopyButton value={liveUrl} label="Copy live link" />
                  <Link
                    href={`/f/${id}`}
                    target="_blank"
                    aria-label="Open the live form"
                    className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-line bg-surface-2 text-fg-2 shadow-sm hover:text-fg"
                  >
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </section>

              <section className="mt-8">
                <h2 className="eyebrow text-fg-3">Embed</h2>
                <div className="mt-2.5 flex items-start gap-2">
                  <pre className="min-w-0 flex-1 overflow-x-auto rounded-[10px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all">
                    {embedSnippet}
                  </pre>
                  <CopyButton value={embedSnippet} label="Copy embed snippet" />
                </div>
                <p className="mt-2 text-[11.5px] text-fg-3">
                  A dedicated embed SDK (script tag, popups, framework wrappers) is on the roadmap —
                  this iframe works anywhere HTML does.
                </p>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}
