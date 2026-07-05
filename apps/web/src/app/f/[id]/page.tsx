// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { formsRepository } from '@formsmithapp/db'
import type { FormDefinition } from '@formsmithapp/engine'
import type { Metadata } from 'next'
import { LiveForm } from '@/components/live-form'
import { getDb } from '@/lib/db'

/**
 * The live respondent page — server-rendered since S2: the snapshot comes
 * straight from the db (no HTTP self-call), so the link works for anyone.
 * Always the LATEST PUBLISHED SNAPSHOT, never the draft.
 */
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function loadSnapshot(id: string): Promise<FormDefinition | null> {
  if (!UUID_RE.test(id)) return null
  return formsRepository(getDb()).getPublicSnapshot(id)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const snapshot = await loadSnapshot(id)
  if (snapshot === null) return { title: 'Formsmith' }
  const welcome = snapshot.blocks[0]
  return {
    title: snapshot.title ?? 'Formsmith form',
    description: welcome?.description ?? welcome?.title ?? undefined,
  }
}

export default async function LiveFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <LiveForm form={await loadSnapshot(id)} />
}
