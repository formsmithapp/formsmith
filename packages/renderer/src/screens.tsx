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
  failed: 'We could not save your response.',
}

/** Delivery status line + a manual retry once delivery has terminally failed. */
export function SubmitStatus() {
  const { status, retry } = useContext(SubmissionContext)
  if (status === 'idle') return null
  return (
    <p className="fsr-submit-status" data-status={status} aria-live="polite">
      {STATUS_LINE[status]}
      {status === 'failed' && (
        <button type="button" className="fsr-ok" onClick={retry}>
          Try again
        </button>
      )}
    </p>
  )
}

/** thankyou — the ending: piped copy (scores!), submit status, per-ending redirect. */
export function EndingView({ block }: { block: Block }) {
  const engine = useEngine()
  const options = useContext(OptionsContext)
  const piped = (text: string) => engine.pipe(text, { escape: false })

  const redirectUrl =
    typeof block.properties?.redirectUrl === 'string' ? block.properties.redirectUrl : undefined
  const ctaLabel =
    typeof block.properties?.ctaLabel === 'string' ? block.properties.ctaLabel : undefined
  const ctaUrl = typeof block.properties?.ctaUrl === 'string' ? block.properties.ctaUrl : undefined

  useEffect(() => {
    if (redirectUrl === undefined) return
    const timer = setTimeout(() => options.onRedirect(redirectUrl), 1400)
    return () => clearTimeout(timer)
  }, [redirectUrl, options])

  return (
    <div>
      <span className="fsr-badge">{BADGE.thankyou}</span>
      {/* Programmatic focus target so completion moves focus here (announced to
          screen readers) instead of dropping it to <body>. */}
      <h1 className="fsr-title" tabIndex={-1} data-fsr-autofocus>
        {piped(block.title)}
      </h1>
      {block.description !== undefined && <p className="fsr-desc">{piped(block.description)}</p>}
      <SubmitStatus />
      {redirectUrl !== undefined && <p className="fsr-submit-status">Redirecting…</p>}
      {ctaLabel !== undefined && ctaUrl !== undefined && (
        <div className="fsr-okrow">
          <a className="fsr-ok" href={ctaUrl} target="_blank" rel="noopener noreferrer">
            {ctaLabel}
            <span className="fsr-visually-hidden"> (opens in a new tab)</span>
          </a>
        </div>
      )}
    </div>
  )
}
