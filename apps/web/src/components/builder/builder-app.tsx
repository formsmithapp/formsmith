// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createBuilderStore } from '@/lib/builder-store'
import { getRepository } from '@/lib/repository/client'
import type { StoredForm } from '@/lib/repository/types'
import { BuilderShell } from './builder-shell'
import { BuilderProvider } from './store-context'

export function BuilderApp({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['form', id],
    queryFn: () => getRepository().get(id),
    staleTime: Number.POSITIVE_INFINITY, // the builder store owns the doc after load
  })

  if (query.isPending) {
    return <div className="grid h-dvh place-items-center bg-canvas text-fg-3">Loading…</div>
  }
  if (!query.data) {
    return (
      <div className="grid h-dvh place-items-center bg-canvas">
        <div className="text-center">
          <h1 className="font-serif text-[24px] font-semibold">Form not found</h1>
          <Link href="/" className="mt-3 inline-block text-[13.5px] text-brand underline">
            Back to your forms
          </Link>
        </div>
      </div>
    )
  }
  return <Mounted stored={query.data} />
}

function Mounted({ stored }: { stored: StoredForm }) {
  const [store] = useState(() => createBuilderStore({ repository: getRepository(), stored }))
  useEffect(() => {
    return () => {
      void store.flushSave()
      store.dispose()
    }
  }, [store])
  return (
    <BuilderProvider value={store}>
      <BuilderShell />
    </BuilderProvider>
  )
}
