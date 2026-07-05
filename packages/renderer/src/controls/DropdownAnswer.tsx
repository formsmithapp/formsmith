// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useId, useRef, useState } from 'react'
import { useEngine, useEngineState } from '../context'
import { type ChoiceItem, choicesOf, scheduleAdvance } from '../helpers'
import { type ControlProps, describedBy, placeholderOf } from './shared'

/**
 * dropdown — a custom type-to-filter combobox (ARIA combobox/listbox
 * pattern with aria-activedescendant). Committing a choice auto-advances
 * like a single-select tap.
 */
export function DropdownAnswer(props: ControlProps) {
  const engine = useEngine()
  const state = useEngineState()
  const { block } = props
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  const choices = choicesOf(block)
  const answer = state.answers[block.ref]
  const answerLabel =
    typeof answer === 'string' ? (choices.find((c) => c.id === answer)?.label ?? '') : ''

  const [query, setQuery] = useState(answerLabel)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const filtered =
    query === '' || query === answerLabel
      ? choices
      : choices.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

  const optionId = (choice: ChoiceItem) => `${listId}-${choice.id}`

  const commit = (choice: ChoiceItem) => {
    engine.setAnswer(block.ref, choice.id)
    setQuery(choice.label)
    setOpen(false)
    scheduleAdvance(engine, block.id)
  }

  const move = (delta: number) => {
    if (!open) {
      setOpen(true)
      return
    }
    if (filtered.length > 0) setActive((active + delta + filtered.length) % filtered.length)
  }

  return (
    <div className="fsr-combo">
      <input
        ref={inputRef}
        className="fsr-input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? filtered[active] && optionId(filtered[active]) : undefined}
        aria-labelledby={props.labelId}
        aria-describedby={describedBy(props)}
        aria-invalid={props.invalid || undefined}
        placeholder={placeholderOf(block, 'Type or select an option')}
        value={query}
        autoComplete="off"
        data-fsr-autofocus
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onChange={(event) => {
          setQuery(event.currentTarget.value)
          setOpen(true)
          setActive(0)
          if (answer !== undefined) engine.setAnswer(block.ref, undefined)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            move(1)
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            move(-1)
          } else if (event.key === 'Enter') {
            const choice = filtered[active]
            if (open && choice !== undefined) {
              event.preventDefault()
              event.stopPropagation() // consume: don't let the shell advance past an open list
              commit(choice)
            }
            // closed list + Enter falls through to the global advance
          } else if (event.key === 'Escape') {
            event.stopPropagation()
            setOpen(false)
          }
        }}
      />
      {open && (
        <div id={listId} className="fsr-listbox" role="listbox" aria-labelledby={props.labelId}>
          {filtered.map((choice, index) => (
            // biome-ignore lint/a11y/useFocusableInteractive: combobox options use aria-activedescendant — virtual focus stays on the input
            // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard is handled on the combobox input per the ARIA pattern
            <div
              key={choice.id}
              id={optionId(choice)}
              className="fsr-option"
              role="option"
              aria-selected={answer === choice.id}
              data-active={index === active}
              // preventDefault keeps focus in the input so blur doesn't race the click
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => commit(choice)}
            >
              {choice.label}
            </div>
          ))}
          {filtered.length === 0 && <div className="fsr-empty">No matches</div>}
        </div>
      )}
    </div>
  )
}
