// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import { ApiKeysPage } from '@/components/api-keys-page'

export const metadata: Metadata = { title: 'API keys · Formsmith' }

export default function Page() {
  return <ApiKeysPage />
}
