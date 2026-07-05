// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { RespondentPage } from '@/components/respondent-page'

export default async function LiveFormPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RespondentPage id={id} />
}
