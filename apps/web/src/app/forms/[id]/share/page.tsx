// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import { SharePage } from '@/components/share-page'

export const metadata: Metadata = { title: 'Share · Formsmith' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <SharePage id={id} />
}
