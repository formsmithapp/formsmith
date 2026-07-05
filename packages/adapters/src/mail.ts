// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { createTransport, type Transporter } from 'nodemailer'

/**
 * The mail boundary. BYO SMTP: configured by a single `SMTP_URL`
 * (smtp[s]://user:pass@host:port) + `EMAIL_FROM`. Unset → NoopMail —
 * features degrade, forms never break (v1 §10).
 */

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface MailAdapter {
  /** True when messages actually leave the machine (drives UI hints). */
  readonly configured: boolean
  send(message: MailMessage): Promise<void>
}

export class SmtpMail implements MailAdapter {
  readonly configured = true
  private readonly transport: Transporter
  private readonly from: string

  constructor(smtpUrl: string, from: string) {
    this.transport = createTransport(smtpUrl)
    this.from = from
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message })
  }
}

export class NoopMail implements MailAdapter {
  readonly configured = false
  /** Sent log — doubles as the test double's assertion surface. */
  readonly dropped: MailMessage[] = []

  async send(message: MailMessage): Promise<void> {
    this.dropped.push(message)
  }
}
