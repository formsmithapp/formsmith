// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { NextConfig } from 'next'

/**
 * Security headers (S5 hardening). Published forms (/f/*) stay FRAMEABLE —
 * people iframe forms manually today and the embed SDK builds on it — so the
 * anti-clickjacking header applies to everything EXCEPT that surface. HSTS is
 * the reverse proxy's job (the container speaks plain HTTP). The CSP is
 * pragmatic-enforced: Next needs inline scripts for hydration ('unsafe-eval'
 * only in dev for react-refresh); img-src allows https anywhere because form
 * themes may point logoUrl at the author's own host.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const baseHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
]

const nextConfig: NextConfig = {
  /** Self-contained server output — the Docker image runs `node server.js`. */
  output: 'standalone',
  // the og:image font is read with fs at runtime — tracing can't see it
  outputFileTracingIncludes: { '/f/**': ['./src/assets/og/**'] },
  async headers() {
    return [
      { source: '/(.*)', headers: baseHeaders },
      // everything except /f/* refuses to be framed
      { source: '/((?!f/).*)', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
    ]
  },
}

export default nextConfig
