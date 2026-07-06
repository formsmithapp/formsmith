// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEngine, useEngineState } from '../context'
import { scaleRange, scheduleAdvance } from '../helpers'
import { type ControlProps, describedBy } from './shared'

function labelProp(block: ControlProps['block'], key: string, fallback: string): string {
  const raw = block.properties?.[key]
  return typeof raw === 'string' && raw !== '' ? raw : fallback
}

/** opinion_scale + nps — the 52px tile row with legend anchors. */
export function ScaleAnswer(props: ControlProps) {
  const engine = useEngine()
  const state = useEngineState()
  const { block } = props
  const range = scaleRange(block) ?? { min: 1, max: 5 }
  const value = state.answers[block.ref]
  const nps = block.type === 'nps'
  const minLabel = labelProp(block, 'minLabel', nps ? 'Not at all likely' : '')
  const maxLabel = labelProp(block, 'maxLabel', nps ? 'Extremely likely' : '')

  const tiles: number[] = []
  for (let n = range.min; n <= range.max; n++) tiles.push(n)

  const record = (n: number) => engine.setAnswer(block.ref, n)
  // Advance only on a genuine pointer click (detail > 0). Chromium fires a
  // click for arrow/Space tile selection too, but with detail === 0, so
  // arrowing the tiles to read them never skips the question (WCAG 3.2.2).
  // Number keys, Enter, and OK still advance via the global handler.
  const advanceOnPointerClick = (detail: number) => {
    if (detail > 0) scheduleAdvance(engine, block.id)
  }

  return (
    <div>
      <div
        className="fsr-scale"
        role="radiogroup"
        aria-labelledby={props.labelId}
        aria-describedby={describedBy(props)}
        aria-invalid={props.invalid || undefined}
        aria-required={block.required || undefined}
      >
        {tiles.map((n, index) => (
          <label key={n} className="fsr-tile" data-selected={value === n}>
            <input
              className="fsr-visually-hidden"
              type="radio"
              name={block.id}
              value={n}
              checked={value === n}
              onChange={() => record(n)}
              onClick={(event) => advanceOnPointerClick(event.detail)}
              aria-label={String(n)}
              data-fsr-autofocus={index === 0 ? true : undefined}
            />
            <span aria-hidden="true">{n}</span>
          </label>
        ))}
      </div>
      {(minLabel !== '' || maxLabel !== '') && (
        <div className="fsr-scale-legend" aria-hidden="true">
          <span>{minLabel !== '' ? `${range.min} — ${minLabel}` : ''}</span>
          <span>{maxLabel !== '' ? `${range.max} — ${maxLabel}` : ''}</span>
        </div>
      )}
    </div>
  )
}
