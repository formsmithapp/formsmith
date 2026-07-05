// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

/**
 * Optimistic session gate (cookie presence only — real validation happens
 * server-side per request, the Better Auth pattern). The dashboard and the
 * builder tabs require a session; `/f/:id` (respondents) and the auth
 * screens stay public.
 */
export function proxy(request: NextRequest) {
  const cookie = getSessionCookie(request)
  if (cookie === null) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/forms/:path*', '/settings/:path*'],
}
