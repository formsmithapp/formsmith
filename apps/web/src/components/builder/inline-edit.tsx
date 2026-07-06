// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useEffect, useRef } from 'react'

/**
 * The builder's inline-editing affordance (design §6.3): contenteditable is a
 * BUILDER convenience only — the respondent runtime uses real form controls.
 * External value syncs into the DOM only when they differ, so the caret never
 * jumps mid-typing.
 */
export function InlineEdit({
  value,
  placeholder,
  label,
  onChange,
  className,
  blurOnEnter = true,
  autoFocus = false,
}: {
  value: string
  placeholder: string
  label: string
  onChange: (next: string) => void
  className?: string
  blurOnEnter?: boolean
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (el !== null && el.textContent !== value) el.textContent = value
  }, [value])

  // Take focus when requested (a freshly inserted block, or the neighbor after
  // a delete). rAF defers past the palette dialog's own close focus-restore.
  useEffect(() => {
    if (!autoFocus) return
    const frame = requestAnimationFrame(() => ref.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [autoFocus])

  return (
    // biome-ignore lint/a11y/useSemanticElements: inline-editing affordance, builder-only (real inputs live in the runtime)
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      tabIndex={0}
      data-placeholder={placeholder}
      className={`editable cursor-text rounded-md transition-shadow focus:shadow-[0_0_0_2px_var(--brand-ring)] ${className ?? ''}`}
      onInput={(event) => onChange(event.currentTarget.textContent ?? '')}
      onKeyDown={(event) => {
        if (blurOnEnter && event.key === 'Enter') {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
    />
  )
}
