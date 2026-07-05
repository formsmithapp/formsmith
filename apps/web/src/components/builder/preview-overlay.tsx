// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { createEngine, FormValidationError } from '@formsmithapp/engine'
import { FormRuntime } from '@formsmithapp/renderer'
import { X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useBuilder } from './store-context'

/**
 * Full-screen respondent preview — literally the runtime renderer on a
 * runtime-mode engine (v1 §6: "the same renderer as the runtime"). This is
 * also the renderer's real-React path. The doc is cloned at open, so edits
 * after opening don't mutate a live session.
 */
export function PreviewOverlay({
  onToast,
}: {
  onToast: (message: string, tone?: 'default' | 'error') => void
}) {
  const store = useBuilder()

  const [hiddenValues, setHiddenValues] = useState<Record<string, string>>({})
  const build = useCallback(
    (hidden: Record<string, string>) => {
      try {
        return {
          engine: createEngine(structuredClone(store.getState().doc), {
            mode: 'runtime',
            hiddenFields: hidden,
          }),
        }
      } catch (error) {
        if (error instanceof FormValidationError) return { issues: error.issues }
        throw error
      }
    },
    [store],
  )
  const [session, setSession] = useState(() => build({}))
  const hiddenNames = store.getState().doc.settings?.hiddenFields ?? []
  const [theme] = useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
  )

  const handleSubmit = useCallback(() => {
    onToast('Preview response recorded — nothing is saved')
  }, [onToast])

  return (
    <div className="fixed inset-0 z-50 bg-canvas">
      {'engine' in session && session.engine !== undefined ? (
        <FormRuntime engine={session.engine} onSubmit={handleSubmit} theme={theme} />
      ) : (
        <div className="grid h-full place-items-center">
          <div className="max-w-md text-center">
            <p className="eyebrow text-error">Can't preview</p>
            <h2 className="mt-2 font-serif text-[22px] font-semibold">The form isn't valid yet</h2>
            <ul className="mt-3 space-y-1 text-left text-[12.5px] text-fg-2">
              {session.issues?.slice(0, 5).map((issue) => (
                <li key={issue}>· {issue}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {hiddenNames.length > 0 && (
        <form
          className="absolute top-4 left-4 z-[55] flex items-center gap-1.5 rounded-[10px] border border-line bg-surface-2 px-2.5 py-1.5 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault()
            setSession(build(hiddenValues))
          }}
        >
          {hiddenNames.map((name) => (
            <input
              key={name}
              aria-label={`Hidden field ${name}`}
              placeholder={name}
              value={hiddenValues[name] ?? ''}
              onChange={(event) =>
                setHiddenValues((prev) => ({ ...prev, [name]: event.target.value }))
              }
              className="w-24 rounded-[7px] border border-line bg-surface px-1.5 py-1 font-mono text-[11px] outline-none focus:border-brand-ring"
            />
          ))}
          <button
            type="submit"
            className="rounded-[7px] bg-brand px-2 py-1 text-[11px] font-semibold text-on-brand"
          >
            Restart
          </button>
        </form>
      )}
      <div className="absolute top-4 right-4 z-[55] flex items-center gap-2.5">
        <span className="eyebrow rounded-full border border-line bg-surface-2 px-3 py-1.5 text-fg-2 shadow-sm">
          Preview
        </span>
        <button
          type="button"
          aria-label="Exit preview"
          onClick={() => store.setPreviewMode(false)}
          className="grid size-9 place-items-center rounded-[9px] border border-line bg-surface-2 text-fg-2 shadow-sm transition-transform duration-100 ease-spring hover:text-fg active:scale-90"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
