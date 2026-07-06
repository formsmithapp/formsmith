// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { loadPublicSnapshot } from '@/lib/live-snapshot'

/**
 * Per-form og:image — every shared form link becomes an ad. Form title in
 * Fraunces on the brand canvas (design tokens inlined: satori sees no CSS).
 * The woff is a vendored static instance (satori reads ttf/otf/woff, not
 * woff2) — OFL text sits beside it in src/assets/og.
 */

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Form preview'

const CANVAS = '#f4f3ec'
const INK = '#17211d'
const BRAND = '#1e5e51'
const TEXT_2 = '#4e564e'

export default async function OpenGraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const snapshot = await loadPublicSnapshot(id).catch(() => null)
  const title = snapshot?.title?.trim() || 'A form, reimagined'
  const fraunces = await readFile(
    join(process.cwd(), 'src/assets/og/fraunces-latin-600-normal.woff'),
  )

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 84px',
        backgroundColor: CANVAS,
        color: INK,
      }}
    >
      <div
        style={{ display: 'flex', width: 132, height: 10, backgroundColor: BRAND, borderRadius: 5 }}
      />
      <div
        style={{
          display: 'flex',
          fontFamily: 'Fraunces',
          fontSize: title.length > 60 ? 56 : 72,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          lineHeight: 1.12,
          maxWidth: 1000,
        }}
      >
        {title.length > 120 ? `${title.slice(0, 117)}…` : title}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30, color: TEXT_2 }}>
          Fill it in a conversation
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontFamily: 'Fraunces',
            fontSize: 34,
            fontWeight: 600,
            color: BRAND,
          }}
        >
          Formsmith
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' }],
    },
  )
}
