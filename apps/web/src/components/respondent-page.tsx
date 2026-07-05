// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { createEngine, extractHiddenFields, type FormDefinition } from '@formsmithapp/engine'
import { FormRuntime } from '@formsmithapp/renderer'
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { getRepository, getResponsesRepository } from '@/lib/repository/client'
import { BrandMark } from './brand-mark'
import { useFormTheming } from './use-theme'

/**
 * The live respondent page (`/f/:id`) — the runtime's first real host.
 * Always renders the LATEST PUBLISHED SNAPSHOT (never the draft): responses
 * stay pinned to the version they were collected under. This is exactly the
 * wiring the server-rendered page will reuse when the api slice lands; today
 * the "fetch" is a localStorage read, so the link works in this browser only.
 */
export function RespondentPage({ id }: { id: string }) {
  const live = useQuery({
    queryKey: ['live-form', id],
    queryFn: async (): Promise<FormDefinition | null> => {
      const stored = await getRepository().get(id)
      if (stored?.publishedVersion === undefined) return null
      return getRepository().getSnapshot(id, stored.publishedVersion)
    },
  })
  const snapshot = live.data ?? null

  const engine = useMemo(() => {
    if (snapshot === null) return null
    try {
      return createEngine(snapshot, {
        mode: 'runtime',
        hiddenFields: extractHiddenFields(snapshot, window.location.search),
      })
    } catch {
      return null // a snapshot that fails to parse renders the unavailable state
    }
  }, [snapshot])

  const theming = useFormTheming(snapshot?.theme)

  useEffect(() => {
    if (snapshot?.title !== undefined) document.title = snapshot.title
  }, [snapshot?.title])

  // Through the renderer's retry queue; the repository re-evaluates against
  // the pinned snapshot (the local stand-in for the API's trust boundary).
  const handleSubmit = useCallback(
    async (payload: {
      formId: string
      formVersion?: number
      answers: Record<string, unknown>
      variables: Record<string, unknown>
      hiddenFields: Record<string, string>
    }) => {
      await getResponsesRepository().add(payload)
    },
    [],
  )

  if (live.isPending) return <div className="h-dvh bg-canvas" />

  if (engine === null) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas px-6">
        <div className="max-w-sm text-center">
          <h1 className="font-serif text-[26px] font-semibold tracking-[-0.012em]">
            This form isn't available
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-2">
            It may not be published yet, or the link is wrong. Forms live in the browser they were
            built in until this workspace is connected to a server.
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
        theme={theming?.appearance ?? 'auto'}
        themeVars={theming?.vars}
      />
    </div>
  )
}
