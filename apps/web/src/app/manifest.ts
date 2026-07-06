// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { MetadataRoute } from 'next'

/** PWA install manifest: brand name, colors, and the scalable app icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Formsmith',
    short_name: 'Formsmith',
    theme_color: '#1e5e51',
    background_color: '#edede4',
    display: 'standalone',
    icons: [{ src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' }],
  }
}
