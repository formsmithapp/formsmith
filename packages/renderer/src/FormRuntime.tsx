// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormEngine } from '@formsmithapp/engine'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  EngineContext,
  OptionsContext,
  type RuntimeOptions,
  SCREEN_TYPES,
  SubmissionContext,
} from './context'
import { choicesOf, commitChoice, isChoiceLike, scaleRange, scheduleAdvance } from './helpers'
import { DownIcon, UpIcon } from './icons'
import { Stage } from './Stage'
import { createRetryQueue, type SubmissionPayload } from './submission'

export interface FormRuntimeProps {
  engine: FormEngine
  /** Delivery transport. Called through the retry queue on completion. */
  onSubmit?: (payload: SubmissionPayload) => Promise<void> | void
  onRedirect?: (url: string) => void
  /** "AI-generated question" label. Default true (disclosure by default). */
  aiDisclosure?: boolean
  /** "Powered by Formsmith" badge. Default true. */
  branding?: boolean
  theme?: 'light' | 'dark' | 'auto'
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target instanceof HTMLTextAreaElement) return true
  if (target instanceof HTMLInputElement) {
    return target.type !== 'radio' && target.type !== 'checkbox'
  }
  return target.isContentEditable
}

/** The respondent runtime root: theme scope, progress, stage, keys, delivery. */
export function FormRuntime(props: FormRuntimeProps) {
  const { engine } = props
  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState)

  const options: RuntimeOptions = useMemo(
    () => ({
      aiDisclosure: props.aiDisclosure !== false,
      branding: props.branding !== false,
      onRedirect:
        props.onRedirect ??
        ((url: string) => {
          if (typeof window !== 'undefined') window.location.assign(url)
        }),
    }),
    [props.aiDisclosure, props.branding, props.onRedirect],
  )

  // Optimistic delivery: ending shows immediately, the queue keeps retrying.
  const queue = useMemo(
    () => (props.onSubmit !== undefined ? createRetryQueue(props.onSubmit) : null),
    [props.onSubmit],
  )
  const queueStatus = useSyncExternalStore(
    queue?.subscribe ?? (() => () => {}),
    queue?.getStatus ?? (() => 'idle' as const),
    queue?.getStatus ?? (() => 'idle' as const),
  )
  useEffect(() => {
    if (queue === null) return
    const off = engine.on('complete', ({ answers, variables }) => {
      const snapshot = engine.serialize()
      queue.push({
        formId: snapshot.formId,
        formVersion: snapshot.formVersion,
        answers,
        variables,
        hiddenFields: engine.getState().hidden,
      })
    })
    return () => {
      off()
      queue.dispose()
    }
  }, [engine, queue])

  // data-theme always wins; "auto" follows the system live.
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  const theme = props.theme ?? 'auto'
  const resolvedTheme = theme === 'auto' ? (systemDark ? 'dark' : 'light') : theme

  const current = engine.getCurrentBlock()
  const progress = engine.progress()
  const showProgress =
    current !== null && current.type !== 'welcome' && state.status === 'in_progress'

  // Keyboard-first: the map lives on `document`, so keys work even when
  // nothing inside the form holds focus (background click, initial load).
  // Events targeting elements OUTSIDE the root (a host page around a
  // preview) are ignored; everything reads fresh engine state — no closures
  // over renders.
  const rootRef = useRef<HTMLDivElement>(null)
  // useLayoutEffect: the listener must exist before the first paint — a
  // keypress can arrive before deferred effects flush.
  useLayoutEffect(() => {
    const digitBuffer = { key: '', at: 0 }
    const onKeyDown = (event: KeyboardEvent) => {
      const root = rootRef.current
      if (root === null || event.defaultPrevented) return
      const target = event.target
      const inRoot = target instanceof Node && root.contains(target)
      const onPage = target === document.body || target === document.documentElement
      if (!inRoot && !onPage) return
      if (engine.getState().status === 'complete') return
      const block = engine.getCurrentBlock()

      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        engine.next()
        return
      }
      if (event.key === 'Enter') return // Shift+Enter belongs to the control (textarea newline)
      if (block === null || isTypingTarget(target)) return

      // Letter keys select choices (A/B/C…; Y/N as synonyms on yes_no).
      if (isChoiceLike(block) && /^[a-z]$/i.test(event.key)) {
        const choices = choicesOf(block)
        const key = event.key.toUpperCase()
        let index = key.charCodeAt(0) - 65
        if (block.type === 'yes_no') {
          if (key === 'Y') index = 0
          else if (key === 'N') index = 1
        }
        const choice = choices[index]
        if (choice !== undefined) {
          event.preventDefault()
          const advance = commitChoice(engine, block, choice.id)
          if (advance) scheduleAdvance(engine, block.id)
        }
        return
      }

      // Digits pick scale/NPS values ("1" then "0" within 400ms → 10).
      const range = scaleRange(block)
      if (range !== null && /^\d$/.test(event.key)) {
        event.preventDefault()
        const now = Date.now()
        let value = Number(event.key)
        if (event.key === '0' && digitBuffer.key === '1' && now - digitBuffer.at < 400) value = 10
        digitBuffer.key = event.key
        digitBuffer.at = now
        if (value >= range.min && value <= range.max) {
          engine.setAnswer(block.ref, value)
          scheduleAdvance(engine, block.id)
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [engine])

  return (
    <EngineContext.Provider value={engine}>
      <OptionsContext.Provider value={options}>
        <SubmissionContext.Provider value={queueStatus}>
          <div className="fsr-root" data-theme={resolvedTheme} ref={rootRef}>
            {showProgress && (
              <div
                className="fsr-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-valuenow={progress.answered}
                aria-label={`${progress.answered} of ${progress.total} answered`}
              >
                <div className="fsr-progress-fill" style={{ width: `${progress.ratio * 100}%` }} />
              </div>
            )}
            <Stage />
            {state.status === 'in_progress' &&
              current !== null &&
              !SCREEN_TYPES.has(current.type) && (
                <div className="fsr-nav">
                  <button
                    type="button"
                    aria-label="Previous question"
                    disabled={state.history.length === 0}
                    onClick={() => engine.prev()}
                  >
                    <UpIcon />
                  </button>
                  <button type="button" aria-label="Next question" onClick={() => engine.next()}>
                    <DownIcon />
                  </button>
                </div>
              )}
            {options.branding && (
              <a
                className="fsr-branding"
                href="https://formsmith.app"
                target="_blank"
                rel="noreferrer"
              >
                Powered by <b>Formsmith</b>
              </a>
            )}
          </div>
        </SubmissionContext.Provider>
      </OptionsContext.Provider>
    </EngineContext.Provider>
  )
}
