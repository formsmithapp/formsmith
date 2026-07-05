// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRetryQueue, type SubmissionPayload } from './submission'

const payload = (): SubmissionPayload => ({
  formId: 'f1',
  answers: { q1: 'a' },
  variables: {},
  hiddenFields: {},
})

describe('createRetryQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('delivers immediately on success', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const queue = createRetryQueue(submit)
    queue.push(payload())
    await vi.runAllTimersAsync()
    expect(submit).toHaveBeenCalledTimes(1)
    expect(queue.getStatus()).toBe('sent')
    queue.dispose()
  })

  it('retries with backoff until it succeeds', async () => {
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const queue = createRetryQueue(submit)
    queue.push(payload())

    await vi.advanceTimersByTimeAsync(0)
    expect(queue.getStatus()).toBe('retrying')
    await vi.advanceTimersByTimeAsync(2_000) // first backoff
    expect(submit).toHaveBeenCalledTimes(2)
    expect(queue.getStatus()).toBe('retrying')
    await vi.advanceTimersByTimeAsync(5_000) // second backoff
    expect(submit).toHaveBeenCalledTimes(3)
    expect(queue.getStatus()).toBe('sent')
    queue.dispose()
  })

  it('notifies subscribers on status changes', async () => {
    const submit = vi.fn().mockResolvedValue(undefined)
    const queue = createRetryQueue(submit)
    const seen: string[] = []
    queue.subscribe(() => seen.push(queue.getStatus()))
    queue.push(payload())
    await vi.runAllTimersAsync()
    expect(seen).toEqual(['sending', 'sent'])
    queue.dispose()
  })

  it('stops after dispose', async () => {
    const submit = vi.fn().mockRejectedValue(new Error('down'))
    const queue = createRetryQueue(submit)
    queue.push(payload())
    await vi.advanceTimersByTimeAsync(0)
    queue.dispose()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(submit).toHaveBeenCalledTimes(1)
  })
})
