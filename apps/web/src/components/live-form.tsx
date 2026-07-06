// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { createEngine, extractHiddenFields, type FormDefinition } from '@formsmithapp/engine'
import { type AiFollowupHandler, FormRuntime } from '@formsmithapp/renderer'
import { parseThemeConfig } from '@formsmithapp/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getResponsesRepository } from '@/lib/repository/client'
import { BrandMark } from './brand-mark'
import { useFormTheming } from './use-theme'

/**
 * The client half of `/f/:id` — the server hands it the published snapshot;
 * this mounts the runtime with the form's theme and URL hidden fields, and
 * submits through the retry queue to the public endpoint (where the server
 * re-evaluates against the pinned snapshot).
 */
export function LiveForm({
  form,
  branding = true,
}: {
  form: FormDefinition | null
  /** "Powered by Formsmith" badge — FORMSMITH_HIDE_BADGE turns it off. */
  branding?: boolean
}) {
  // the runtime is interactive-only: SSR (and the first client paint) render
  // a stable shell so hydration matches; the engine reads location.search
  // for hidden fields, which only exists client-side
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const engine = useMemo(() => {
    if (form === null || typeof window === 'undefined') return null
    try {
      return createEngine(form, {
        mode: 'runtime',
        hiddenFields: extractHiddenFields(form, window.location.search),
      })
    } catch {
      return null
    }
  }, [form])

  const theming = useFormTheming(form?.theme)

  const handleSubmit = useCallback(
    async (payload: {
      formId: string
      formVersion?: number
      answers: Record<string, unknown>
      variables: Record<string, unknown>
      hiddenFields: Record<string, string>
      aiExchanges?: import('@formsmithapp/renderer').AiExchangeEntry[]
      _hp?: string
    }) => {
      await getResponsesRepository().add(payload)
    },
    [],
  )

  // the AI exchange: fetch the next signed question from the public endpoint
  const formId = form?.id
  const handleAiFollowup: AiFollowupHandler = useCallback(
    async ({ ref, baseAnswer, exchanges, index }) => {
      if (formId === undefined) return null
      try {
        const res = await fetch(`/api/v1/f/${formId}/ai`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ref,
            index,
            baseAnswer: String(baseAnswer ?? ''),
            exchanges: exchanges.map(({ index: i, question, meta, sig, answer }) => ({
              index: i,
              question,
              meta,
              sig,
              answer,
            })),
          }),
        })
        if (!res.ok) return null
        const body = (await res.json()) as {
          done: boolean
          question?: string
          meta?: Record<string, unknown>
          sig?: string
        }
        return body.done || body.question === undefined
          ? null
          : { question: body.question, meta: body.meta ?? {}, sig: body.sig ?? '' }
      } catch {
        return null // network death → no follow-up, never an error state
      }
    },
    [formId],
  )

  const logoUrl = useMemo(
    () => (form === null ? undefined : parseThemeConfig(form.theme).logoUrl),
    [form],
  )

  if (!mounted) return <div className="h-dvh bg-canvas" />

  if (engine === null) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-[26px] font-semibold tracking-[-0.012em]">
            This form isn't available
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-2">
            It may not be published yet, or the link is wrong. Ask whoever sent it for a fresh one.
          </p>
          <div className="mt-8 flex justify-center opacity-60">
            <BrandMark />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh">
      <FormRuntime
        engine={engine}
        onSubmit={handleSubmit}
        onAiFollowup={handleAiFollowup}
        theme={theming?.appearance ?? 'auto'}
        themeVars={theming?.vars}
        logoUrl={logoUrl}
        branding={branding}
      />
    </div>
  )
}
