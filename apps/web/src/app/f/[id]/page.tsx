// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import { LiveForm } from '@/components/live-form'
import { envFlag, serverEnv } from '@/lib/env'
import { loadPublicSnapshot } from '@/lib/live-snapshot'

/**
 * The live respondent page — server-rendered since S2: the snapshot comes
 * straight from the db (no HTTP self-call), so the link works for anyone.
 * Always the LATEST PUBLISHED SNAPSHOT, never the draft. The og:image beside
 * this file gives every shared link a branded card (v1 §5).
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const snapshot = await loadPublicSnapshot(id)
  if (snapshot === null) return { title: 'Formsmith' }
  const welcome = snapshot.blocks[0]
  const title = snapshot.title ?? 'Formsmith form'
  const description = welcome?.description ?? welcome?.title ?? undefined
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Formsmith' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function LiveFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const env = serverEnv()
  const abuse = env.FORMSMITH_ABUSE_CONTACT
  const reportAbuseUrl =
    abuse === undefined
      ? undefined
      : `mailto:${abuse}?subject=${encodeURIComponent(`Report abuse: form ${id}`)}`
  return (
    <LiveForm
      form={await loadPublicSnapshot(id)}
      branding={!envFlag(env.FORMSMITH_HIDE_BADGE)}
      reportAbuseUrl={reportAbuseUrl}
    />
  )
}
