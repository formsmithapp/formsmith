// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useEffect, useRef } from 'react'

/**
 * Cloudflare Turnstile widget, explicit-render. Rendered only when
 * the instance sets a site key (self-host default: off, so this never loads).
 * The token is handed up via `onToken` and forwarded on the auth request as the
 * `x-captcha-response` header the Better Auth captcha plugin verifies.
 */

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
      theme?: 'auto' | 'light' | 'dark'
    },
  ) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
    __fsTurnstileReady?: () => void
  }
}

const SCRIPT_ID = 'cf-turnstile-script'
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

/** Load the Turnstile script once; resolve when `window.turnstile` is ready. */
function loadTurnstile(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.turnstile !== undefined) return Promise.resolve()
  return new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID)
    if (existing !== null) {
      existing.addEventListener('load', () => resolve(), { once: true })
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(), { once: true })
    document.head.appendChild(script)
  })
}

export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string
  /** Fires with a token on success, and with null on expiry/error. */
  onToken: (token: string | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let widgetId: string | null = null
    let cancelled = false
    void loadTurnstile().then(() => {
      if (cancelled || containerRef.current === null || window.turnstile === undefined) return
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    })
    return () => {
      cancelled = true
      if (widgetId !== null && window.turnstile !== undefined) window.turnstile.remove(widgetId)
    }
  }, [siteKey, onToken])

  return <div ref={containerRef} className="mt-1 flex justify-center [min-height:65px]" />
}
