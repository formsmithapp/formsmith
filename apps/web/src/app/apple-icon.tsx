// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ImageResponse } from 'next/og'

/**
 * The touch icon (home-screen / bookmark). Renders the brand mark: cream form
 * lines on the teal rounded canvas, centred with padding. Drawn with plain
 * divs (satori-native) using the same tokens as the SVG favicon and og:image.
 */

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const BRAND = '#1e5e51'
const CREAM = '#f4f3ec'
const bar = (width: string) => ({
  height: 9,
  width,
  borderRadius: 5,
  backgroundColor: CREAM,
})

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BRAND,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: 92 }}>
        <div style={bar('100%')} />
        <div style={bar('71%')} />
        <div style={bar('43%')} />
      </div>
    </div>,
    size,
  )
}
