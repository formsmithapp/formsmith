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

  const pick = (id: string) => {
    const advance = commitChoice(engine, block, id)
    if (advance) scheduleAdvance(engine, block.id)
  }

  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the role is dynamic (radiogroup|group); both support aria-labelledby
    <div
      className="fsr-choices"
      role={multiple ? 'group' : 'radiogroup'}
      aria-labelledby={props.labelId}
      aria-describedby={describedBy(props)}
      aria-invalid={props.invalid || undefined}
      aria-required={block.required || undefined}
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
              onChange={() => pick(choice.id)}
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
