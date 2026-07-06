// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block } from '@formsmithapp/engine'
import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion, useEngine, useEngineState } from './context'
import { QuestionShell } from './QuestionShell'
import { EndingView, ScreenView, SubmitStatus } from './screens'

const EXIT_MS = 180
const EASE = 'cubic-bezier(.22, 1, .36, 1)'

function viewFor(block: Block | null) {
  if (block === null) return <EndingFallback />
  if (block.type === 'welcome' || block.type === 'statement') return <ScreenView block={block} />
  if (block.type === 'thankyou') return <EndingView block={block} />
  return <QuestionShell block={block} />
}

/** Degenerate case: a form that completes without an ending block. */
function EndingFallback() {
  return (
    <div>
      <span className="fsr-badge">Thank you</span>
      <h1 className="fsr-title">Thanks for your response.</h1>
      {/* Route through the real delivery status so this never claims success
          while the submission is still sending or has failed. */}
      <SubmitStatus />
    </div>
  )
}

/**
 * The transition host. A *displayed* block trails the engine's current block:
 * on navigate the old content exits via WAAPI (fade + directional drift),
 * then the new block mounts with the stage-in spring (CSS animation, keyed
 * remount). The engine is authoritative throughout — this is pure view state.
 */
export function Stage() {
  const engine = useEngine()
  const state = useEngineState()
  const [displayed, setDisplayed] = useState<{ block: Block | null; direction: 'fwd' | 'back' }>(
    () => ({ block: engine.getCurrentBlock(), direction: 'fwd' }),
  )
  const stageRef = useRef<HTMLDivElement>(null)
  const historyLength = useRef(state.history.length)
  const animating = useRef(false)
  const touchStartY = useRef<number | null>(null)
  const lastWheel = useRef(0)

  const displayedId = displayed.block?.id ?? null

  useEffect(() => {
    if (state.currentId === displayedId) {
      historyLength.current = state.history.length
      return
    }
    const direction = state.history.length >= historyLength.current ? 'fwd' : 'back'
    historyLength.current = state.history.length

    const swap = () => {
      animating.current = false
      setDisplayed({ block: engine.getCurrentBlock(), direction })
    }

    const el = stageRef.current
    if (el === null || prefersReducedMotion()) {
      swap()
      return
    }
    animating.current = true
    const drift = direction === 'fwd' ? -12 : 12
    el.animate(
      [
        { opacity: 1, transform: 'none' },
        { opacity: 0, transform: `translateY(${drift}px)` },
      ],
      { duration: EXIT_MS, easing: EASE, fill: 'forwards' },
    ).finished.then(swap, swap)
  }, [state.currentId, state.history.length, displayedId, engine])

  // Focus the new block's primary control once it lands.
  // biome-ignore lint/correctness/useExhaustiveDependencies(displayedId): the effect re-runs per displayed block, not per closure value
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const target = stageRef.current?.querySelector<HTMLElement>('[data-fsr-autofocus]')
      target?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [displayedId])

  const navigable = (target: EventTarget | null): boolean => {
    if (animating.current || state.status === 'complete') return false
    return !(target instanceof Element && target.closest('textarea, .fsr-listbox'))
  }

  return (
    <div
      className="fsr-viewport"
      onTouchStart={(event) => {
        touchStartY.current = event.touches[0]?.clientY ?? null
      }}
      onTouchEnd={(event) => {
        const start = touchStartY.current
        touchStartY.current = null
        const end = event.changedTouches[0]?.clientY
        if (start === null || end === undefined || !navigable(event.target)) return
        const delta = start - end
        if (delta > 60) engine.next()
        else if (delta < -60) engine.prev()
      }}
      onWheel={(event) => {
        const now = Date.now()
        if (now - lastWheel.current < 700 || Math.abs(event.deltaY) < 40) return
        if (!navigable(event.target)) return
        lastWheel.current = now
        if (event.deltaY > 0) engine.next()
        else engine.prev()
      }}
    >
      <div
        ref={stageRef}
        className="fsr-stage"
        key={displayedId ?? 'fsr-end'}
        data-direction={displayed.direction}
      >
        <div className={displayed.direction === 'fwd' ? 'fsr-enter-fwd' : 'fsr-enter-back'}>
          {viewFor(displayed.block)}
        </div>
      </div>
    </div>
  )
}
