// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata, Viewport } from 'next'
// All registry font pairs are DECLARED here (same-origin, hashed by Next);
// a family's files download only when a theme actually uses it.
import '@formsmithapp/ui/fonts.css'
import '@formsmithapp/renderer/styles.css'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  // Resolves per-form og:image and other relative URLs to an absolute public
  // URL. Reads the raw base (not the validating serverEnv, which would make
  // `next build` require a full env) with a localhost fallback: correct for
  // self-hosters, and the deploy origin (BETTER_AUTH_URL) at runtime, so
  // shared-link previews are never dead.
  metadataBase: new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'),
  title: 'Formsmith',
  description: 'Open-source, AI-native conversational forms.',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#edede4' },
    { media: '(prefers-color-scheme: dark)', color: '#0e1512' },
  ],
}

// Sets data-theme before first paint — no flash, and data-theme always wins.
const themeScript = `(function(){try{var t=localStorage.getItem('fs.theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}})()`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap, no user input */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
