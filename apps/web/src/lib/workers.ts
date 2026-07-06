// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type MailAdapter,
  NoopMail,
  PgBossQueue,
  type QueueAdapter,
  SmtpMail,
} from '@formsmithapp/adapters'
import { startWorkers } from '@formsmithapp/api'
import { getDb } from './db'
import { envFlag, serverEnv } from './env'

/**
 * Queue/mail singletons + worker bootstrap for the unified build. Cached on
 * globalThis so Next dev's HMR never spawns a second pg-boss instance.
 */

const globals = globalThis as unknown as {
  __fsQueue?: QueueAdapter
  __fsMail?: MailAdapter
  __fsWorkersStarted?: boolean
}

export function getQueue(): QueueAdapter {
  if (globals.__fsQueue === undefined) {
    globals.__fsQueue = new PgBossQueue(serverEnv().DATABASE_URL)
  }
  return globals.__fsQueue
}

export function getMail(): MailAdapter {
  if (globals.__fsMail === undefined) {
    const env = serverEnv()
    globals.__fsMail =
      env.SMTP_URL !== undefined && env.EMAIL_FROM !== undefined
        ? new SmtpMail(env.SMTP_URL, env.EMAIL_FROM)
        : new NoopMail()
  }
  return globals.__fsMail
}

export async function startAppWorkers(): Promise<void> {
  if (globals.__fsWorkersStarted === true) return
  globals.__fsWorkersStarted = true
  await startWorkers({
    db: getDb(),
    queue: getQueue(),
    mail: getMail(),
    baseUrl: serverEnv().BETTER_AUTH_URL,
    allowPrivateEgress: envFlag(serverEnv().WEBHOOK_ALLOW_PRIVATE),
  })
  console.log('[workers] webhook/notification workers started')
}
