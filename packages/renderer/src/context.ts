// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { EngineState, FormEngine } from '@formsmithapp/engine'
import { createContext, useContext, useSyncExternalStore } from 'react'
import type { QueueStatus } from './submission'

export const EngineContext = createContext<FormEngine | null>(null)

export interface RuntimeOptions {
  /** "AI-generated question" label on ai_followup blocks. Default true. */
  aiDisclosure: boolean
  /** "Powered by Formsmith" badge. Default true (self-host config can disable). */
  branding: boolean
  /** Per-ending redirects go through here — embeds can postMessage instead. */
  onRedirect: (url: string) => void
}

export const OptionsContext = createContext<RuntimeOptions>({
  aiDisclosure: true,
  branding: true,
  onRedirect: (url) => {
    if (typeof window !== 'undefined') window.location.assign(url)
  },
})

/** Delivery state of the completed response, for the ending screen. */
export interface SubmissionState {
  status: QueueStatus
  /** Manual re-attempt, surfaced when delivery has terminally failed. */
  retry: () => void
}

export const SubmissionContext = createContext<SubmissionState>({
  status: 'idle',
  retry: () => {},
})

export function useEngine(): FormEngine {
  const engine = useContext(EngineContext)
  if (engine === null) throw new Error('Formsmith renderer components need a <FormRuntime> parent')
  return engine
}

/** The one binding between the view and the engine's reactive store. */
export function useEngineState(): EngineState {
  const engine = useEngine()
  return useSyncExternalStore(engine.subscribe, engine.getState, engine.getState)
}

/** Screens are non-answerable and excluded from numbering/progress. */
export const SCREEN_TYPES = new Set(['welcome', 'statement', 'thankyou'])

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}
