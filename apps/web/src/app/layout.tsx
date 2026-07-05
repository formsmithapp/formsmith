// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
// All registry font pairs are DECLARED here (same-origin, hashed by Next);
// a family's files download only when a theme actually uses it.
import '@formsmithapp/ui/fonts.css'
import '@formsmithapp/renderer/styles.css'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Formsmith',
  description: 'Open-source, AI-native conversational forms.',
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
