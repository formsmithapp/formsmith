// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEngine, useEngineState } from '../context'
import {
  choicesOf,
  commitChoice,
  isMultiSelect,
  letterFor,
  scheduleAdvance,
  selectedChoiceIds,
} from '../helpers'
import { CheckIcon } from '../icons'
import { type ControlProps, describedBy } from './shared'

/**
 * multiple_choice (single + multi), yes_no, legal — brand-tinted rows with
 * mono letter-key tiles. Real radio/checkbox inputs live visually hidden
 * inside each row, so arrow keys and screen readers behave natively.
 */
export function ChoiceAnswer(props: ControlProps) {
  const engine = useEngine()
  const state = useEngineState()
  const { block } = props
  const choices = choicesOf(block)
  const multiple = isMultiSelect(block)
  const selected = selectedChoiceIds(block, state.answers[block.ref])

  const record = (id: string) => {
    commitChoice(engine, block, id)
  }
  // Advance only on a genuine pointer click. Chromium also fires a click when a
  // radio is selected via arrow keys or Space, but with detail === 0, so
  // browsing the radios never skips the question (WCAG 3.2.2). Keyboard users
  // commit with a letter key, Enter, or the OK button; multi never advances.
  const advanceOnPointerClick = (detail: number) => {
    if (detail > 0 && !multiple) scheduleAdvance(engine, block.id)
  }

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is dynamic (radiogroup|group); both support aria-labelledby
    <div
      className="fsr-choices"
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={props.labelId}
      aria-describedby={describedBy(props)}
      aria-invalid={props.invalid || undefined}
      aria-required={(!multiple && block.required) || undefined}
    >
      {choices.map((choice, index) => {
        const letter = letterFor(index)
        const isSelected = selected.has(choice.id)
        return (
          <label key={choice.id} className="fsr-choice" data-selected={isSelected}>
            <input
              className="fsr-visually-hidden"
              type={multiple ? 'checkbox' : 'radio'}
              name={block.id}
              value={choice.id}
              checked={isSelected}
              onChange={() => record(choice.id)}
              onClick={(event) => advanceOnPointerClick(event.detail)}
              data-fsr-autofocus={index === 0 ? true : undefined}
            />
            {letter !== null && (
              <span className="fsr-key" aria-hidden="true">
                {letter}
              </span>
            )}
            <span>{choice.label}</span>
            <span className="fsr-choice-check" aria-hidden="true">
              <CheckIcon />
            </span>
          </label>
        )
      })}
    </div>
  )
}
