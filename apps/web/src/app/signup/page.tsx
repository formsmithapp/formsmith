// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import { AuthScreen } from '@/components/auth-screen'
import { enabledSocialProviders, signupDisabled } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign up · Formsmith' }

export const dynamic = 'force-dynamic' // reads env per-request, never at build

export default function SignUpPage() {
  return (
    <AuthScreen
      mode="signup"
      providers={enabledSocialProviders()}
      signupDisabled={signupDisabled()}
    />
  )
}
