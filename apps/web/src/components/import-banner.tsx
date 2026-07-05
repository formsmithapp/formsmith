// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import type { FormDefinition } from '@formsmithapp/engine'
import { useQueryClient } from '@tanstack/react-query'
import { HardDriveUpload, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { StoredForm } from '@/lib/repository/types'

/**
 * Local-first migration: forms built before the server era live only in this
 * browser's localStorage. One click moves them (with their published
 * snapshots) into the workspace. Responses deliberately do NOT migrate —
 * they were never server-verified.
 */

interface LocalSummary {
  id: string
}

function readLocalForms(): LocalSummary[] {
  try {
    return JSON.parse(localStorage.getItem('fs.forms') ?? '[]') as LocalSummary[]
  } catch {
    return []
  }
}

export function ImportBanner() {
  const queryClient = useQueryClient()
  // read AFTER mount — the server renders nothing, so hydration matches
  const [localForms, setLocalForms] = useState<LocalSummary[]>([])
  useEffect(() => setLocalForms(readLocalForms()), [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (localForms.length === 0) return null

  const importAll = async () => {
    setBusy(true)
    setError(null)
    try {
      const entries = []
      for (const summary of localForms) {
        const raw = localStorage.getItem(`fs.form.${summary.id}`)
        if (raw === null) continue
        const stored = JSON.parse(raw) as StoredForm
        const versions: { version: number; doc: FormDefinition }[] = []
        for (let v = 1; v <= (stored.publishedVersion ?? 0); v++) {
          const snapshot = localStorage.getItem(`fs.form.${summary.id}.v${v}`)
          if (snapshot !== null) {
            versions.push({ version: v, doc: JSON.parse(snapshot) as FormDefinition })
          }
        }
        entries.push({
          sourceId: summary.id,
          doc: stored.form,
          status: stored.status,
          publishedVersion: stored.publishedVersion,
          versions,
        })
      }
      if (entries.length === 0) throw new Error('nothing readable to import')
      const res = await fetch('/api/v1/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ forms: entries }),
      })
      if (res.status !== 201) throw new Error(`import failed (${res.status})`)
      const body = (await res.json()) as { imported: { sourceId: string }[] }

      // clean up ONLY what the server confirmed
      for (const item of body.imported) {
        const raw = localStorage.getItem(`fs.form.${item.sourceId}`)
        const stored = raw === null ? null : (JSON.parse(raw) as StoredForm)
        for (let v = 1; v <= (stored?.publishedVersion ?? 0); v++) {
          localStorage.removeItem(`fs.form.${item.sourceId}.v${v}`)
        }
        localStorage.removeItem(`fs.form.${item.sourceId}`)
        localStorage.removeItem(`fs.responses.${item.sourceId}`)
      }
      const remaining = readLocalForms().filter(
        (summary) => !body.imported.some((item) => item.sourceId === summary.id),
      )
      localStorage.setItem('fs.forms', JSON.stringify(remaining))
      setLocalForms(remaining)
      await queryClient.invalidateQueries({ queryKey: ['forms'] })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 flex items-center gap-3 rounded-[12px] border border-accent/40 bg-accent-soft/40 px-4 py-3">
      <HardDriveUpload size={16} className="shrink-0 text-accent-strong" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-semibold">
          {localForms.length} form{localForms.length === 1 ? '' : 's'} live only in this browser.
        </span>{' '}
        Import them (with their published versions) into your workspace — test responses don't
        migrate.
        {error !== null && <span className="block text-error">{error}</span>}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={importAll}
        className="flex shrink-0 items-center gap-1.5 rounded-[9px] bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm disabled:opacity-60 dark:text-ink"
      >
        {busy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
        Import
      </button>
    </div>
  )
}
