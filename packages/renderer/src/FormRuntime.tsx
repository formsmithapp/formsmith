// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { FormEngine } from '@formsmithapp/engine'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { AiExchangeView } from './AiExchange'
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
import {
  type AiExchangeEntry,
  createRetryQueue,
  type QueueStatus,
  type SubmissionPayload,
} from './submission'

/** Host-provided follow-up fetcher (the /f/:id/ai endpoint in the web app). */
export type AiFollowupHandler = (ctx: {
  ref: string
  baseAnswer: unknown
  exchanges: AiExchangeEntry[]
  index: number
}) => Promise<{ question: string; meta: Record<string, unknown>; sig: string } | null>

interface AiSession {
  ref: string
  index: number
  question: string | null
  meta: Record<string, unknown>
  sig: string
  busy: boolean
}

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
  /**
   * Flat CSS custom-property overrides (`--brand`, `--canvas`, …) applied
   * inline on `.fsr-root`, winning over the stylesheet. Derivation happens in
   * the HOST (`deriveTheme` in @formsmithapp/ui) — the runtime stays dumb.
   */
  themeVars?: Record<string, string>
  /**
   * Enables the AI follow-up exchange loop on `ai_followup` blocks. The
   * runtime stays dumb: it renders whatever signed question the host fetches
   * and carries the exchanges on the submission payload. Absent → the block
   * behaves like a plain question (base answer only).
   */
  onAiFollowup?: AiFollowupHandler
  /** Author's logo (ThemeConfig.logoUrl) — compact, top-left of the stage. */
  logoUrl?: string
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

  /* ---------- the AI follow-up exchange loop (D0: inside the block) ---------- */
  // Exchange answers NEVER touch the engine or the form document — they ride
  // the submission payload as server-signed exchanges. The engine stays
  // AI-agnostic; interception happens by wrapping `next()`/`prev()`.
  const onAiFollowup = props.onAiFollowup
  const [aiSession, setAiSession] = useState<AiSession | null>(null)
  const aiSessionRef = useRef<AiSession | null>(null)
  aiSessionRef.current = aiSession
  const aiExchangesRef = useRef<AiExchangeEntry[]>([])
  const hpRef = useRef<HTMLInputElement>(null)
  const aiDoneRef = useRef<Set<string>>(new Set())
  const aiSubmitRef = useRef<(() => void) | null>(null)

  const finishAiSession = useCallback(
    (ref: string) => {
      aiDoneRef.current.add(ref)
      setAiSession(null)
      engine.next()
    },
    [engine],
  )

  const requestFollowup = useCallback(
    (ref: string, index: number) => {
      if (onAiFollowup === undefined) return
      setAiSession({ ref, index, question: null, meta: {}, sig: '', busy: true })
      const exchanges = aiExchangesRef.current.filter((entry) => entry.ref === ref)
      onAiFollowup({ ref, baseAnswer: engine.getState().answers[ref], exchanges, index })
        .then((step) => {
          if (aiSessionRef.current?.ref !== ref) return // session exited meanwhile
          if (step === null) finishAiSession(ref)
          else {
            setAiSession({
              ref,
              index,
              question: step.question,
              meta: step.meta,
              sig: step.sig,
              busy: false,
            })
          }
        })
        .catch(() => {
          if (aiSessionRef.current?.ref === ref) finishAiSession(ref)
        })
    },
    [engine, onAiFollowup, finishAiSession],
  )

  const submitExchange = useCallback(
    (answer: string) => {
      const session = aiSessionRef.current
      if (session === null || session.busy || session.question === null) return
      if (answer.trim() === '') {
        finishAiSession(session.ref) // declining to elaborate is allowed
        return
      }
      aiExchangesRef.current.push({
        ref: session.ref,
        index: session.index,
        question: session.question,
        meta: session.meta,
        sig: session.sig,
        answer,
      })
      requestFollowup(session.ref, session.index + 1)
    },
    [finishAiSession, requestFollowup],
  )

  // Every next()/prev() call site (keyboard, chevrons, OK buttons, controls)
  // goes through this wrapper — the engine object is plain closures, so a
  // spread-and-override is safe and children need zero changes.
  const runtimeEngine: FormEngine = useMemo(() => {
    if (onAiFollowup === undefined) return engine
    const stay = (): { ok: boolean; block: ReturnType<typeof engine.getCurrentBlock> } => ({
      ok: false,
      block: engine.getCurrentBlock(),
    })
    return {
      ...engine,
      next: () => {
        const session = aiSessionRef.current
        if (session !== null) {
          if (!session.busy) aiSubmitRef.current?.()
          return stay()
        }
        const block = engine.getCurrentBlock()
        if (block?.type === 'ai_followup' && !aiDoneRef.current.has(block.ref)) {
          const base = engine.getState().answers[block.ref]
          if (typeof base === 'string' && base.trim() !== '') {
            requestFollowup(block.ref, 1)
            return stay()
          }
        }
        return engine.next()
      },
      prev: () => {
        if (aiSessionRef.current !== null) {
          setAiSession(null) // first prev exits the exchange, back to the base question
          return stay()
        }
        return engine.prev()
      },
    }
  }, [engine, onAiFollowup, requestFollowup])

  // Optimistic delivery: ending shows immediately, the queue keeps retrying.
  // The queue is created INSIDE the effect so StrictMode's double-invoke
  // (mount → cleanup → mount) gets a fresh queue instead of a disposed one.
  const [queueStatus, setQueueStatus] = useState<QueueStatus>('idle')
  const retryRef = useRef<(() => void) | null>(null)
  const retry = useCallback(() => retryRef.current?.(), [])
  const onSubmit = props.onSubmit
  useEffect(() => {
    if (onSubmit === undefined) return
    const queue = createRetryQueue(onSubmit)
    retryRef.current = queue.retry
    const offStatus = queue.subscribe(() => setQueueStatus(queue.getStatus()))
    const offComplete = engine.on('complete', ({ answers, variables }) => {
      const snapshot = engine.serialize()
      const hpValue = hpRef.current?.value ?? ''
      queue.push({
        formId: snapshot.formId,
        formVersion: snapshot.formVersion,
        answers,
        variables,
        hiddenFields: engine.getState().hidden,
        aiExchanges: aiExchangesRef.current.length > 0 ? [...aiExchangesRef.current] : undefined,
        _hp: hpValue === '' ? undefined : hpValue,
      })
    })
    return () => {
      offComplete()
      offStatus()
      queue.dispose()
      retryRef.current = null
    }
  }, [engine, onSubmit])
  const submissionState = useMemo(() => ({ status: queueStatus, retry }), [queueStatus, retry])

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
        runtimeEngine.next()
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
  }, [engine, runtimeEngine])

  return (
    <EngineContext.Provider value={runtimeEngine}>
      <OptionsContext.Provider value={options}>
        <SubmissionContext.Provider value={submissionState}>
          <div
            className="fsr-root"
            data-theme={resolvedTheme}
            style={props.themeVars as CSSProperties | undefined}
            ref={rootRef}
          >
            {/* honeypot: visually hidden, tab-skipped — humans never touch it */}
            <input
              ref={hpRef}
              className="fsr-hp"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            {props.logoUrl !== undefined && <img className="fsr-logo" src={props.logoUrl} alt="" />}
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
            {aiSession !== null ? (
              <AiExchangeView
                question={aiSession.question}
                busy={aiSession.busy}
                aiDisclosure={options.aiDisclosure}
                registerSubmit={(submit) => {
                  aiSubmitRef.current = submit
                }}
                onSubmit={submitExchange}
              />
            ) : (
              <Stage />
            )}
            {state.status === 'in_progress' &&
              current !== null &&
              !SCREEN_TYPES.has(current.type) && (
                <div className="fsr-nav">
                  <button
                    type="button"
                    aria-label="Previous question"
                    disabled={state.history.length === 0 && aiSession === null}
                    onClick={() => runtimeEngine.prev()}
                  >
                    <UpIcon />
                  </button>
                  <button
                    type="button"
                    aria-label="Next question"
                    onClick={() => runtimeEngine.next()}
                  >
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
                <span className="fsr-visually-hidden"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        </SubmissionContext.Provider>
      </OptionsContext.Provider>
    </EngineContext.Provider>
  )
}
