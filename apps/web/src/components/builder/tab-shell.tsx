// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import Link from 'next/link'
import { TabHeader } from '../tab-header'

/** Placeholder for the Connect tab — webhooks + API keys arrive with the api slice. */
export function TabShell({ formId, tab }: { formId: string; tab: 'connect' }) {
  return (
    <div className="flex h-dvh flex-col bg-canvas">
      <TabHeader formId={formId} title="" active={tab} />
      <div className="grid flex-1 place-items-center">
        <div className="text-center">
          <p className="eyebrow text-brand">Connect</p>
          <h1 className="mt-3 font-serif text-[28px] font-semibold tracking-[-0.012em]">
            Coming soon
          </h1>
          <p className="mt-2 text-[13.5px] text-fg-2">
            Webhooks and API keys land with the API slice.
          </p>
          <Link
            href={`/forms/${formId}/create`}
            className="mt-6 inline-block rounded-[9px] bg-brand px-4 py-2 text-[13.5px] font-semibold text-on-brand shadow-sm"
          >
            Back to Create
          </Link>
        </div>
      </div>
    </div>
  )
}
