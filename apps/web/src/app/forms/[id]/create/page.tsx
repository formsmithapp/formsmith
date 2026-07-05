// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { BuilderApp } from '@/components/builder/builder-app'

export default async function CreatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <BuilderApp id={id} />
}
