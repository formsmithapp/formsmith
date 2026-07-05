// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import type { Metadata } from 'next'
import { ReferenceClient } from './reference-client'

export const metadata: Metadata = {
  title: 'API Reference — Formsmith',
  description: 'The Formsmith data-plane REST API reference.',
}

/**
 * Public API reference for the data plane, rendered from the OpenAPI spec the
 * Hono app already emits at `/api/v1/openapi.json`. The Scalar UI is bundled by
 * Next (see `reference-client`) — served same-origin, no third-party CDN, so a
 * self-hosted / air-gapped instance renders it with nothing to fetch externally.
 */
export default function ReferencePage() {
  return <ReferenceClient />
}
