// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { Block } from '@formsmithapp/engine'
import { useContext, useEffect } from 'react'
import { OptionsContext, SubmissionContext, useEngine } from './context'

const BADGE: Record<string, string> = {
  welcome: 'Welcome',
  statement: 'Statement',
  thankyou: 'Thank you',
}

function buttonText(block: Block, fallback: string): string {
  const raw = block.properties?.buttonText
  return typeof raw === 'string' && raw !== '' ? raw : fallback
}

/** welcome + statement — badge, serif title, continue button. */
export function ScreenView({ block }: { block: Block }) {
  const engine = useEngine()
  const piped = (text: string) => engine.pipe(text, { escape: false })
  return (
    <div>
      <span className="fsr-badge">{BADGE[block.type] ?? block.type}</span>
      <h1 className="fsr-title">{piped(block.title)}</h1>
      {block.description !== undefined && <p className="fsr-desc">{piped(block.description)}</p>}
      <div className="fsr-okrow">
        <button type="button" className="fsr-ok" onClick={() => engine.next()} data-fsr-autofocus>
          {buttonText(block, block.type === 'welcome' ? 'Start' : 'Continue')}
        </button>
        <span className="fsr-hint">
          press <kbd>Enter ↵</kbd>
        </span>
      </div>
    </div>
  )
}

const STATUS_LINE: Record<string, string> = {
  sending: 'Recording your response…',
  retrying: 'Reconnecting to record your response…',
  sent: 'Response recorded.',
}

/** thankyou — the ending: piped copy (scores!), submit status, per-ending redirect. */
export function EndingView({ block }: { block: Block }) {
  const engine = useEngine()
  const options = useContext(OptionsContext)
  const submission = useContext(SubmissionContext)
  const piped = (text: string) => engine.pipe(text, { escape: false })

  const redirectUrl =
    typeof block.properties?.redirectUrl === 'string' ? block.properties.redirectUrl : undefined

  useEffect(() => {
    if (redirectUrl === undefined) return
    const timer = setTimeout(() => options.onRedirect(redirectUrl), 1400)
    return () => clearTimeout(timer)
  }, [redirectUrl, options])

  return (
    <div>
      <span className="fsr-badge">{BADGE.thankyou}</span>
      <h1 className="fsr-title">{piped(block.title)}</h1>
      {block.description !== undefined && <p className="fsr-desc">{piped(block.description)}</p>}
      {submission !== 'idle' && (
        <p className="fsr-submit-status" data-status={submission} aria-live="polite">
          {STATUS_LINE[submission]}
        </p>
      )}
      {redirectUrl !== undefined && <p className="fsr-submit-status">Redirecting…</p>}
    </div>
  )
}
