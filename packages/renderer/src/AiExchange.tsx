// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useState } from 'react'

/**
 * The AI follow-up exchange view — shown INSTEAD of the stage while an
 * ai_followup block runs its generated questions. Fully renderer-owned:
 * exchange answers never touch the engine; they ride the submission payload
 * as verified exchanges.
 */
export function AiExchangeView({
  question,
  busy,
  aiDisclosure,
  registerSubmit,
  onSubmit,
}: {
  /** null while the next question is being generated. */
  question: string | null
  busy: boolean
  aiDisclosure: boolean
  /** Hands the runtime an imperative submit (the document Enter handler). */
  registerSubmit: (submit: (() => void) | null) => void
  onSubmit: (answer: string) => void
}) {
  const [draft, setDraft] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    registerSubmit(() => onSubmit(areaRef.current?.value ?? ''))
    return () => registerSubmit(null)
  }, [registerSubmit, onSubmit])

  useEffect(() => {
    setDraft('')
    if (question !== null) areaRef.current?.focus()
  }, [question])

  return (
    <div className="fsr-viewport">
      <div className="fsr-stage fsr-enter-fwd">
        {aiDisclosure && <span className="fsr-ai-tag">AI-generated question</span>}
        {question === null ? (
          <h1 className="fsr-title fsr-title-ai" aria-live="polite" aria-busy="true">
            Thinking<span aria-hidden="true">…</span>
          </h1>
        ) : (
          <>
            <h1 className="fsr-title fsr-title-ai" id="fsr-ai-question">
              {question}
            </h1>
            <div className="fsr-answer">
              <textarea
                ref={areaRef}
                className="fsr-textarea"
                rows={3}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-labelledby="fsr-ai-question"
                data-fsr-autofocus
              />
            </div>
            <div className="fsr-okrow">
              <button
                type="button"
                className="fsr-ok"
                disabled={busy}
                onClick={() => onSubmit(areaRef.current?.value ?? '')}
              >
                OK
              </button>
              <span className="fsr-hint">press Enter ↵ — leave empty to skip</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
