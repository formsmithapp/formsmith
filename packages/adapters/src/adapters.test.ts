// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { NoopMail } from './mail'
import { InMemoryQueue } from './queue'

describe('InMemoryQueue (the test double)', () => {
  it('records sends and dispatches to registered handlers', async () => {
    const queue = new InMemoryQueue()
    const handled: unknown[] = []
    await queue.work('webhook.deliver', async (data, meta) => {
      handled.push({ data, meta })
    })
    await queue.send('webhook.deliver', { id: 1 }, { retryLimit: 5 })
    await queue.send('unhandled.job', { id: 2 })

    expect(queue.sent).toHaveLength(2)
    expect(queue.sent[0]).toMatchObject({ name: 'webhook.deliver', options: { retryLimit: 5 } })
    expect(handled).toEqual([{ data: { id: 1 }, meta: { attempt: 1 } }])
  })

  it('records schedules', async () => {
    const queue = new InMemoryQueue()
    await queue.schedule('maintenance.prune', '0 3 * * *')
    expect(queue.scheduled).toEqual([{ name: 'maintenance.prune', cron: '0 3 * * *' }])
  })
})

describe('NoopMail', () => {
  it('is unconfigured and drops (but records) messages', async () => {
    const mail = new NoopMail()
    expect(mail.configured).toBe(false)
    await mail.send({ to: 'a@b.c', subject: 'Hi', text: 'Body' })
    expect(mail.dropped).toHaveLength(1)
    expect(mail.dropped[0]?.subject).toBe('Hi')
  })
})
