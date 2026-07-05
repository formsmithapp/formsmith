// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Optimistic submission with retry-on-reconnect: the respondent sees the
 * ending immediately; delivery keeps retrying in the background with backoff,
 * and immediately when the browser reports connectivity again. Transport
 * stays the caller's concern — this queue only orchestrates attempts.
 */

export interface SubmissionPayload {
  formId: string
  formVersion?: number
  answers: Record<string, unknown>
  variables: Record<string, unknown>
  hiddenFields: Record<string, string>
}

export type SubmitFn = (payload: SubmissionPayload) => Promise<void> | void

export type QueueStatus = 'idle' | 'sending' | 'sent' | 'retrying'

export interface RetryQueue {
  push(payload: SubmissionPayload): void
  getStatus(): QueueStatus
  /** Subscribe to status changes; returns unsubscribe. */
  subscribe(listener: () => void): () => void
  dispose(): void
}

const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000]

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
    } catch {
      attempt += 1
      setStatus('retrying')
      schedule()
    }
  }

  const onOnline = () => {
    if (pending !== null) void attemptSend()
  }
  if (typeof window !== 'undefined') window.addEventListener('online', onOnline)

  return {
    push(payload) {
      pending = payload
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
