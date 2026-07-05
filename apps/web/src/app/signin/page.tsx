// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { AuthScreen } from '@/components/auth-screen'
import { enabledSocialProviders } from '@/lib/auth'

export const dynamic = 'force-dynamic' // reads env per-request, never at build

export default function SignInPage() {
  return <AuthScreen mode="signin" providers={enabledSocialProviders()} />
}
