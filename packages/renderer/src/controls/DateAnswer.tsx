// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef, useState } from 'react'
import { useEngine } from '../context'
import { type ControlProps, describedBy } from './shared'

interface Segments {
  d: string
  m: string
  y: string
}

function fromAnswer(value: unknown): Segments {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y = '', m = '', d = ''] = value.split('-')
    return { d, m, y }
  }
  return { d: '', m: '', y: '' }
}

/**
 * date — a segmented Day / Month / Year input (the keyboard-first pattern;
 * a calendar grid is hostile for arbitrary dates like birthdays). Mono
 * labels make the segment order unambiguous without i18n.
 */
export function DateAnswer(props: ControlProps) {
  const engine = useEngine()
  const { block } = props
  const [segs, setSegs] = useState<Segments>(() => fromAnswer(engine.getState().answers[block.ref]))
  const dayRef = useRef<HTMLInputElement>(null)
  const monthRef = useRef<HTMLInputElement>(null)
  const yearRef = useRef<HTMLInputElement>(null)

  const push = (next: Segments) => {
    setSegs(next)
    if (next.d.length >= 1 && next.m.length >= 1 && next.y.length === 4) {
      engine.setAnswer(block.ref, `${next.y}-${next.m.padStart(2, '0')}-${next.d.padStart(2, '0')}`)
    } else {
      engine.setAnswer(block.ref, undefined)
    }
  }

  const segment = (
    key: keyof Segments,
    label: string,
    size: 2 | 4,
    ref: React.RefObject<HTMLInputElement | null>,
    nextRef?: React.RefObject<HTMLInputElement | null>,
    prevRef?: React.RefObject<HTMLInputElement | null>,
  ) => (
    <div className={`fsr-seg fsr-seg-${label.toLowerCase()}`}>
      <span className="fsr-seg-label" id={`${block.id}-${key}`}>
        {label}
      </span>
      <input
        ref={ref}
        className="fsr-input"
        type="text"
        inputMode="numeric"
        value={segs[key]}
        placeholder={size === 4 ? 'YYYY' : label.slice(0, 1).repeat(2)}
        maxLength={size}
        aria-labelledby={`${props.labelId} ${block.id}-${key}`}
        aria-describedby={describedBy(props)}
        aria-invalid={props.invalid || undefined}
        autoComplete="off"
        data-fsr-autofocus={key === 'd' ? true : undefined}
        onChange={(event) => {
          const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, size)
          push({ ...segs, [key]: digits })
          if (digits.length === size) nextRef?.current?.focus()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Backspace' && segs[key] === '') prevRef?.current?.focus()
        }}
      />
    </div>
  )

  return (
    <fieldset className="fsr-date" aria-labelledby={props.labelId}>
      {segment('d', 'Day', 2, dayRef, monthRef)}
      <span className="fsr-date-sep" aria-hidden="true">
        /
      </span>
      {segment('m', 'Month', 2, monthRef, yearRef, dayRef)}
      <span className="fsr-date-sep" aria-hidden="true">
        /
      </span>
      {segment('y', 'Year', 4, yearRef, undefined, monthRef)}
    </fieldset>
  )
}
