// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Metadata } from 'next'
import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'

export const metadata: Metadata = {
  title: 'Page not found · Formsmith',
}

export default function NotFound() {
  return (
    <div className="relative grid h-dvh place-items-center bg-canvas px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:var(--canvas-vignette)]"
      />
      <div className="relative w-full max-w-sm text-center">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <div className="mt-6 rounded-[16px] border border-line bg-surface-2 p-6 shadow-md">
          <p className="eyebrow text-brand">Error 404</p>
          <h1 className="mt-2 font-serif text-[24px] font-semibold tracking-[-0.012em]">
            Page not found
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-2">
            The page you are looking for moved, or never existed.
          </p>
          <Link
            href="/"
            className="mt-5 inline-block rounded-[9px] bg-brand px-4 py-2.5 text-[14px] font-semibold text-on-brand shadow-sm hover:bg-brand-strong"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  )
}
