// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react'
import { useEngine, useEngineState } from '../context'
import { type ControlProps, describedBy, placeholderOf } from './shared'

const NUMERIC_RE = /^-?(\d+\.?\d*|\.\d+)$/

/**
 * number — a text input with numeric inputmode. Parseable text is stored as
 * a number; anything else is stored raw so the engine's validator produces
 * the "Please enter a number." message instead of the view guessing.
 */
export function NumberAnswer(props: ControlProps) {
  const engine = useEngine()
  const state = useEngineState()
  const answer = state.answers[props.block.ref]
  const [text, setText] = useState(() =>
    typeof answer === 'number' ? String(answer) : typeof answer === 'string' ? answer : '',
  )

  return (
    <input
      className="fsr-input"
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholderOf(props.block, '0')}
      onChange={(event) => {
        const raw = event.currentTarget.value
        setText(raw)
        if (raw === '') engine.setAnswer(props.block.ref, undefined)
        else if (NUMERIC_RE.test(raw)) engine.setAnswer(props.block.ref, Number(raw))
        else engine.setAnswer(props.block.ref, raw)
      }}
      aria-labelledby={props.labelId}
      aria-describedby={describedBy(props)}
      aria-invalid={props.invalid || undefined}
      autoComplete="off"
      data-fsr-autofocus
    />
  )
}
