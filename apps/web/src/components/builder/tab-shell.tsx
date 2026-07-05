// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import Link from 'next/link'

const LABEL: Record<string, string> = {
  connect: 'Connect',
  share: 'Share',
  results: 'Results',
}

/** Placeholder for the post-M1 tabs — real content arrives with the api/db slice. */
export function TabShell({ formId, tab }: { formId: string; tab: string }) {
  return (
    <div className="grid h-dvh place-items-center bg-canvas">
      <div className="text-center">
        <p className="eyebrow text-brand">{LABEL[tab] ?? tab}</p>
        <h1 className="mt-3 font-serif text-[28px] font-semibold tracking-[-0.012em]">
          Coming soon
        </h1>
        <p className="mt-2 text-[13.5px] text-fg-2">
          {tab === 'results'
            ? 'Responses arrive once forms can be served.'
            : 'This surface lands with the API slice.'}
        </p>
        <Link
          href={`/forms/${formId}/create`}
          className="mt-6 inline-block rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-sm"
        >
          Back to Create
        </Link>
      </div>
    </div>
  )
}
