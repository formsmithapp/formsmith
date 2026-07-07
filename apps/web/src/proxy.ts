// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'
import { hostRedirect } from '@/lib/host-split'

/**
 * The proxy gate. Two concerns, in order:
 *
 * 1. Optional host split: 308 wrong-host PAGE requests to their canonical host.
 *    No-op unless FORMSMITH_FORMS_HOST is set. The proxy always runs on Node.js
 *    in Next 16, so it reads that env at RUNTIME (a prebuilt image sets it per
 *    instance), not build-inlined like the edge runtime.
 * 2. Optimistic session gate (cookie presence only, real validation is
 *    per-request server-side): the dashboard/builder/settings need a session;
 *    `/f/:id` (respondents) and the auth screens stay public.
 */

const AUTHED = [/^\/$/, /^\/forms(\/|$)/, /^\/settings(\/|$)/]
const needsSession = (pathname: string): boolean => AUTHED.some((re) => re.test(pathname))

export function proxy(request: NextRequest): NextResponse {
  const formsHost = process.env.FORMSMITH_FORMS_HOST
  if (formsHost !== undefined && formsHost !== '') {
    let appHost: string | null = null
    try {
      appHost = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').host
    } catch {
      appHost = null
    }
    if (appHost !== null) {
      const host = request.headers.get('host') ?? request.nextUrl.host
      const target = hostRedirect({
        host,
        pathname: request.nextUrl.pathname,
        formsHost,
        appHost,
      })
      if (target !== null) {
        const url = request.nextUrl.clone()
        url.host = target
        url.port = '' // subdomains use the default port
        return NextResponse.redirect(url, 308)
      }
    }
  }

  if (needsSession(request.nextUrl.pathname) && getSessionCookie(request) === null) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }
  return NextResponse.next()
}

export const config = {
  // All page routes (skip /api, which host-split never redirects, and assets).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)'],
}
