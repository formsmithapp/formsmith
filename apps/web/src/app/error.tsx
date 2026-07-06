// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { BrandMark } from '@/components/brand-mark'

/**
 * The route error boundary. Client-only (Next requirement) with a reset() to
 * re-attempt the failed render. No error detail is shown to the respondent.
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
          <p className="eyebrow text-brand">Something went wrong</p>
          <h1 className="mt-2 font-serif text-[24px] font-semibold tracking-[-0.012em]">
            That did not load
          </h1>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-fg-2">
            An unexpected error interrupted the page. You can try again.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 inline-block rounded-[9px] bg-brand px-4 py-2.5 text-[14px] font-semibold text-on-brand shadow-sm hover:bg-brand-strong"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  )
}
