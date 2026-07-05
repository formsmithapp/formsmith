// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { PgBoss } from 'pg-boss'

/**
 * The queue boundary (architecture §10). v1 impl is pg-boss — the queue
 * lives INSIDE the same Postgres, so self-host stays two containers. The
 * in-memory impl is the test double.
 */

export interface JobMeta {
  /** 1-based attempt number (retries increment it). */
  attempt: number
}

export interface SendOptions {
  retryLimit?: number
  /** Exponential backoff between retries. */
  retryBackoff?: boolean
  retryDelaySeconds?: number
}

export interface QueueAdapter {
  send(name: string, data: unknown, options?: SendOptions): Promise<void>
  work(name: string, handler: (data: unknown, meta: JobMeta) => Promise<void>): Promise<void>
  /** Cron-scheduled recurring job (e.g. nightly maintenance). */
  schedule(name: string, cron: string): Promise<void>
  stop(): Promise<void>
}

export class PgBossQueue implements QueueAdapter {
  private readonly boss: PgBoss
  private started = false
  private readonly queues = new Set<string>()

  constructor(connectionString: string) {
    this.boss = new PgBoss({ connectionString })
    this.boss.on('error', (error: unknown) => console.error('[queue]', error))
  }

  private async ensure(name: string): Promise<void> {
    if (!this.started) {
      await this.boss.start()
      this.started = true
    }
    if (!this.queues.has(name)) {
      await this.boss.createQueue(name)
      this.queues.add(name)
    }
  }

  async send(name: string, data: unknown, options?: SendOptions): Promise<void> {
    await this.ensure(name)
    await this.boss.send(name, data as object, {
      retryLimit: options?.retryLimit ?? 5,
      retryBackoff: options?.retryBackoff ?? true,
      retryDelay: options?.retryDelaySeconds ?? 60,
    })
  }

  async work(
    name: string,
    handler: (data: unknown, meta: JobMeta) => Promise<void>,
  ): Promise<void> {
    await this.ensure(name)
    await this.boss.work(
      name,
      { includeMetadata: true },
      async (jobs: { data: unknown; retryCount: number }[]) => {
        for (const job of jobs) {
          await handler(job.data, { attempt: job.retryCount + 1 })
        }
      },
    )
  }

  async schedule(name: string, cron: string): Promise<void> {
    await this.ensure(name)
    await this.boss.schedule(name, cron)
  }

  async stop(): Promise<void> {
    if (this.started) await this.boss.stop()
  }
}

interface SentJob {
  name: string
  data: unknown
  options?: SendOptions
}

/**
 * Test double: `send` dispatches synchronously to a registered handler (or
 * records unhandled jobs); the `sent` log is the assertion surface. No
 * retries — retry semantics belong to pg-boss and are proven in e2e.
 */
export class InMemoryQueue implements QueueAdapter {
  readonly sent: SentJob[] = []
  readonly scheduled: { name: string; cron: string }[] = []
  private readonly handlers = new Map<string, (data: unknown, meta: JobMeta) => Promise<void>>()

  async send(name: string, data: unknown, options?: SendOptions): Promise<void> {
    this.sent.push({ name, data, options })
    const handler = this.handlers.get(name)
    if (handler !== undefined) await handler(data, { attempt: 1 })
  }

  async work(
    name: string,
    handler: (data: unknown, meta: JobMeta) => Promise<void>,
  ): Promise<void> {
    this.handlers.set(name, handler)
  }

  async schedule(name: string, cron: string): Promise<void> {
    this.scheduled.push({ name, cron })
  }

  async stop(): Promise<void> {
    this.handlers.clear()
  }
}
