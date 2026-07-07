// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Optimistic submission with retry-on-reconnect: the respondent sees the
 * ending immediately; delivery keeps retrying in the background with backoff,
 * and immediately when the browser reports connectivity again. Transport
 * stays the caller's concern — this queue only orchestrates attempts.
 */

/** A server-issued AI exchange: question + trace meta + signature + answer. */
export interface AiExchangeEntry {
  ref: string
  index: number
  question: string
  meta: Record<string, unknown>
  sig: string
  answer: string
}

export interface SubmissionPayload {
  formId: string
  formVersion?: number
  answers: Record<string, unknown>
  variables: Record<string, unknown>
  hiddenFields: Record<string, string>
  /** Present when ai_followup exchanges happened — verified server-side. */
  aiExchanges?: AiExchangeEntry[]
  /** Honeypot value — humans never see the field; set only when a bot
   * filled it (the server accepts-and-discards). */
  _hp?: string
}

export type SubmitFn = (payload: SubmissionPayload) => Promise<void> | void

export type QueueStatus = 'idle' | 'sending' | 'sent' | 'retrying' | 'failed' | 'closed'

/**
 * A submit rejection the queue must NOT retry: the server has permanently
 * refused this response (e.g. the form hit its monthly cap). By convention the
 * transport throws an error carrying `terminal: true`; the queue then goes to
 * the terminal 'closed' status instead of burning retries on a lost cause.
 */
export function isTerminalRejection(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { terminal?: unknown }).terminal === true
  )
}

export interface RetryQueue {
  push(payload: SubmissionPayload): void
  getStatus(): QueueStatus
  /** Manual re-attempt after 'failed': resets the attempt count and retries. */
  retry(): void
  /** Subscribe to status changes; returns unsubscribe. */
  subscribe(listener: () => void): () => void
  dispose(): void
}

const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000]
/** Give up automatic retries after this many failed attempts (then 'failed'). */
const MAX_ATTEMPTS = 6

export function createRetryQueue(submit: SubmitFn): RetryQueue {
  let status: QueueStatus = 'idle'
  let pending: SubmissionPayload | null = null
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  const listeners = new Set<() => void>()

  const setStatus = (next: QueueStatus) => {
    if (status === next) return
    status = next
    for (const listener of [...listeners]) listener()
  }

  const schedule = () => {
    const delay = BACKOFF_MS[Math.min(attempt - 1, BACKOFF_MS.length - 1)] ?? 60_000
    timer = setTimeout(attemptSend, delay)
  }

  async function attemptSend(): Promise<void> {
    if (disposed || pending === null) return
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    setStatus('sending')
    try {
      await submit(pending)
      pending = null
      setStatus('sent')
    } catch (error) {
      // permanent refusal (e.g. the form is closed): stop, never retry
      if (isTerminalRejection(error)) {
        pending = null
        setStatus('closed')
        return
      }
      attempt += 1
      // Bounded automatic retry: after MAX_ATTEMPTS we stop the loop and go
      // terminal so the respondent sees a clear failure (and a manual retry)
      // instead of "Reconnecting…" forever.
      if (attempt >= MAX_ATTEMPTS) {
        setStatus('failed')
        return
      }
      setStatus('retrying')
      schedule()
    }
  }

  const onOnline = () => {
    if (pending !== null && status !== 'failed') void attemptSend()
  }
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

  return {
    push(payload) {
      pending = payload
      attempt = 0
      void attemptSend()
    },
    retry() {
      if (pending === null || status === 'sending') return
      attempt = 0
      void attemptSend()
    },
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      disposed = true
      if (timer !== null) clearTimeout(timer)
      if (typeof window !== 'undefined') window.removeEventListener('online', onOnline)
      listeners.clear()
    },
  }
}
