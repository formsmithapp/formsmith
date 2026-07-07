// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block } from '@formsmithapp/engine'
import { useContext } from 'react'
import { OptionsContext, SCREEN_TYPES, useEngine, useEngineState } from './context'
import { ChoiceAnswer } from './controls/ChoiceAnswer'
import { DateAnswer } from './controls/DateAnswer'
import { DropdownAnswer } from './controls/DropdownAnswer'
import { LongTextAnswer } from './controls/LongTextAnswer'
import { NumberAnswer } from './controls/NumberAnswer'
import { ScaleAnswer } from './controls/ScaleAnswer'
import type { ControlProps } from './controls/shared'
import { TextAnswer } from './controls/TextAnswer'
import { ArrowIcon, Sparkle } from './icons'

const CONTROLS: Record<string, (props: ControlProps) => ReturnType<typeof TextAnswer>> = {
  short_text: TextAnswer,
  email: TextAnswer,
  phone: TextAnswer,
  website: TextAnswer,
  ai_followup: TextAnswer,
  long_text: LongTextAnswer,
  number: NumberAnswer,
  multiple_choice: ChoiceAnswer,
  yes_no: ChoiceAnswer,
  legal: ChoiceAnswer,
  dropdown: DropdownAnswer,
  date: DateAnswer,
  opinion_scale: ScaleAnswer,
  nps: ScaleAnswer,
}

/** A question: eyebrow index, serif hero title, description, control, errors, OK. */
export function QuestionShell({ block }: { block: Block }) {
  const engine = useEngine()
  const state = useEngineState()
  const options = useContext(OptionsContext)

  const answerable = engine
    .getVisibleBlocks()
    .filter((candidate) => !SCREEN_TYPES.has(candidate.type))
  const position = answerable.findIndex((candidate) => candidate.id === block.id) + 1

  const isAi = block.type === 'ai_followup'
  const errors = state.errors[block.ref] ?? []
  const invalid = errors.length > 0
  const labelId = `fsr-t-${block.id}`
  const descId = block.description !== undefined ? `fsr-d-${block.id}` : undefined
  const errorId = invalid ? `fsr-e-${block.id}` : undefined
  const Control = CONTROLS[block.type]

  // engine.pipe escapes by default for HTML sinks; the view renders text
  // nodes (framework-escaped), so raw values are the correct, safe form here.
  const piped = (text: string) => engine.pipe(text, { escape: false })

  return (
    <div className={invalid ? 'fsr-invalid' : undefined}>
      {isAi && options.aiDisclosure && (
        <span className="fsr-ai-tag">
          <Sparkle /> AI-generated question
        </span>
      )}
      {position > 0 && !isAi && (
        <p className="fsr-eyebrow" aria-hidden="true">
          Question {position} <ArrowIcon />
        </p>
      )}
      <h1 className={`fsr-title${isAi ? ' fsr-title-ai' : ''}`} id={labelId}>
        {position > 0 && !isAi && (
          <span className="fsr-visually-hidden">Question {position}, </span>
        )}
        {piped(block.title)}
        {block.required && (
          <>
            <span className="fsr-required" aria-hidden="true">
              *
            </span>
            {/* Announced to screen readers so required is known before submit,
                not only after an error (covers controls whose role cannot carry
                aria-required, e.g. the date fieldset). */}
            <span className="fsr-visually-hidden"> (required)</span>
          </>
        )}
      </h1>
      {block.description !== undefined && (
        <p className="fsr-desc" id={descId}>
          {piped(block.description)}
        </p>
      )}
      <div className="fsr-answer">
        {Control !== undefined && (
          <Control
            block={block}
            labelId={labelId}
            descId={descId}
            errorId={errorId}
            invalid={invalid}
          />
        )}
      </div>
      <div aria-live="polite">
        {invalid && (
          <p className="fsr-error" id={errorId}>
            {errors[0]}
          </p>
        )}
      </div>
      <div className="fsr-okrow">
        <button type="button" className="fsr-ok" onClick={() => engine.next()}>
          OK
        </button>
        <span className="fsr-hint">
          press <kbd>Enter ↵</kbd>
          {block.type === 'long_text' && (
            <>
              {' · '}
              <kbd>Shift ⇧ + Enter</kbd> for a line break
            </>
          )}
        </span>
      </div>
    </div>
  )
}
