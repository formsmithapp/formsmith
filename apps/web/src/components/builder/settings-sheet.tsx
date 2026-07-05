// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { Settings, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { isValidRef, slugify } from '@/lib/slug'
import { useBuilder, useBuilderState } from './store-context'

/** Form-level concerns: score variables and hidden fields (URL prefill). */
export function SettingsSheet() {
  const store = useBuilder()
  const { doc } = useBuilderState()
  const [open, setOpen] = useState(false)
  const [variableDraft, setVariableDraft] = useState('')
  const [hiddenDraft, setHiddenDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const variables = doc.variables ?? []
  const hiddenFields = doc.settings?.hiddenFields ?? []
  const taken = new Set([
    ...doc.blocks.map((b) => b.ref),
    ...variables.map((v) => v.name),
    ...hiddenFields,
  ])

  const addName = (raw: string, kind: 'variable' | 'hidden') => {
    const name = slugify(raw)
    if (!isValidRef(name, taken)) {
      setError(`"${name}" is taken or reserved`)
      return
    }
    setError(null)
    if (kind === 'variable') {
      store.setVariables([...variables, { name, type: 'number', initialValue: 0 }])
      setVariableDraft('')
    } else {
      store.setHiddenFields([...hiddenFields, name])
      setHiddenDraft('')
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Form settings"
          className="grid size-8 place-items-center rounded-lg border border-line bg-surface-2 text-fg-2 shadow-sm transition-transform duration-100 ease-spring active:scale-90"
        >
          <Settings size={15} />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-[16vh] left-1/2 z-50 w-[min(460px,92vw)] -translate-x-1/2 rounded-[16px] border border-line bg-surface-2 p-5 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="font-serif text-[18px] font-semibold">
              Form settings
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close settings" className="text-fg-3 hover:text-fg">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <section className="mb-5">
            <h3 className="eyebrow mb-2 text-fg-3">Variables (scoring)</h3>
            <ul className="mb-2 space-y-1.5">
              {variables.map((variable) => (
                <li
                  key={variable.name}
                  className="flex items-center justify-between rounded-[8px] border border-line-soft px-2.5 py-1.5 font-mono text-[12px]"
                >
                  Σ {variable.name}{' '}
                  <span className="text-fg-3">starts at {String(variable.initialValue ?? 0)}</span>
                  <button
                    type="button"
                    aria-label={`Delete variable ${variable.name}`}
                    onClick={() =>
                      store.setVariables(variables.filter((v) => v.name !== variable.name))
                    }
                    className="text-fg-3 hover:text-error"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                if (variableDraft.trim() !== '') addName(variableDraft, 'variable')
              }}
            >
              <input
                value={variableDraft}
                onChange={(e) => setVariableDraft(e.target.value)}
                placeholder="score"
                aria-label="New variable name"
                className="flex-1 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-brand-ring"
              />
              <button
                type="submit"
                className="rounded-[8px] bg-brand px-3 text-[12px] font-semibold text-on-brand"
              >
                Add
              </button>
            </form>
            <p className="mt-1.5 text-[11px] text-fg-3">
              Deleting a variable removes the rules that use it.
            </p>
          </section>

          <section>
            <h3 className="eyebrow mb-2 text-fg-3">Hidden fields (URL prefill)</h3>
            <ul className="mb-2 space-y-1.5">
              {hiddenFields.map((name) => (
                <li
                  key={name}
                  className="flex items-center justify-between rounded-[8px] border border-line-soft px-2.5 py-1.5 font-mono text-[12px]"
                >
                  #{name} <span className="truncate text-[10.5px] text-fg-3">?{name}=value</span>
                  <button
                    type="button"
                    aria-label={`Delete hidden field ${name}`}
                    onClick={() => store.setHiddenFields(hiddenFields.filter((n) => n !== name))}
                    className="text-fg-3 hover:text-error"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                if (hiddenDraft.trim() !== '') addName(hiddenDraft, 'hidden')
              }}
            >
              <input
                value={hiddenDraft}
                onChange={(e) => setHiddenDraft(e.target.value)}
                placeholder="utm_source"
                aria-label="New hidden field name"
                className="flex-1 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[12px] outline-none focus:border-brand-ring"
              />
              <button
                type="submit"
                className="rounded-[8px] bg-brand px-3 text-[12px] font-semibold text-on-brand"
              >
                Add
              </button>
            </form>
          </section>
          {error !== null && <p className="mt-2 text-[11.5px] text-error">{error}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
