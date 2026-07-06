// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import '@scalar/api-reference-react/style.css'
import dynamic from 'next/dynamic'

// Bundled into this route's chunk by Next (no external CDN), and loaded
// client-side only: the reference core mounts into the DOM on `createApiReference`,
// so it must not execute during SSR. `ssr: false` is allowed here because this is
// a Client Component.
const ApiReferenceReact = dynamic(
  () => import('@scalar/api-reference-react').then((m) => m.ApiReferenceReact),
  {
    ssr: false,
    loading: () => <p style={{ padding: '2rem' }}>Loading API reference…</p>,
  },
)

export function ReferenceClient() {
  return (
    <ApiReferenceReact
      configuration={{
        url: '/api/v1/openapi.json',
        // Scalar's "Ask AI Agent", "Generate MCP", and "Open API Client" route out to
        // Scalar's cloud/desktop (an Agent key / api.scalar.com / the Scalar client) —
        // disabled so this page stays fully same-origin with zero third-party egress,
        // consistent with the self-host / privacy stance. A native, self-hostable MCP
        // server + BYO-key API assistant are planned post-launch instead. "Try It"
        // still works — it runs same-origin against our own API.
        agent: { disabled: true },
        mcp: { disabled: true },
        hideClientButton: true,
      }}
    />
  )
}
