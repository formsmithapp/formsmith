// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEngine, useEngineState } from '../context'
import { type ControlProps, describedBy, placeholderOf } from './shared'

const INPUT_TYPE: Record<string, string> = {
  email: 'email',
  phone: 'tel',
  website: 'url',
}

const PLACEHOLDER: Record<string, string> = {
  email: 'name@example.com',
  phone: '+1 555 000 0000',
  website: 'https://',
}

/** short_text, email, phone, website, ai_followup — the serif underline input. */
export function TextAnswer(props: ControlProps) {
  const engine = useEngine()
  const state = useEngineState()
  const value = state.answers[props.block.ref]

  return (
    <input
      className="fsr-input"
      type={INPUT_TYPE[props.block.type] ?? 'text'}
      value={typeof value === 'string' ? value : ''}
      placeholder={placeholderOf(props.block, PLACEHOLDER[props.block.type])}
      onChange={(event) => {
        const next = event.currentTarget.value
        engine.setAnswer(props.block.ref, next === '' ? undefined : next)
      }}
      aria-labelledby={props.labelId}
      aria-describedby={describedBy(props)}
      aria-invalid={props.invalid || undefined}
      autoComplete="off"
      data-fsr-autofocus
    />
  )
}
