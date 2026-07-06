// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import { FormsListPage } from '@/components/forms-list-page'

export const metadata: Metadata = {
  title: 'Your forms · Formsmith',
}

export default function Page() {
  return <FormsListPage />
}
