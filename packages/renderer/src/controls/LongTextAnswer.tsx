// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from 'react'
import { useEngine, useEngineState } from '../context'
import { type ControlProps, describedBy, placeholderOf } from './shared'

/** long_text — Enter advances, Shift+Enter makes a line break (hinted in the shell). */
export function LongTextAnswer(props: ControlProps) {
  const engine = useEngine()
  const state = useEngineState()
  const ref = useRef<HTMLTextAreaElement>(null)
  const value = state.answers[props.block.ref]
  const text = typeof value === 'string' ? value : ''

  useEffect(() => {
    const el = ref.current
    if (el !== null) {
      el.style.height = 'auto'
      el.style.height = `${Math.max(120, el.scrollHeight)}px`
    }
  }, [])

  return (
    <textarea
      ref={ref}
      className="fsr-textarea"
      value={text}
      placeholder={placeholderOf(props.block)}
      rows={4}
      onChange={(event) => {
        const el = event.currentTarget
        el.style.height = 'auto'
        el.style.height = `${Math.max(120, el.scrollHeight)}px`
        engine.setAnswer(props.block.ref, el.value === '' ? undefined : el.value)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault()
          event.stopPropagation()
          engine.next()
        }
      }}
      aria-labelledby={props.labelId}
      aria-describedby={describedBy(props)}
      aria-invalid={props.invalid || undefined}
      aria-required={props.block.required || undefined}
      data-fsr-autofocus
    />
  )
}
