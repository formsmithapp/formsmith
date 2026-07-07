// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { authClient, useSession } from '@/lib/auth-client'

/**
 * Quiet reminder: when the instance requires verification and the
 * signed-in account has not confirmed its email yet, nudge them. Building and
 * previewing stay open; publishing and AI are what need the verified email.
 * Renders nothing when verification is off or the account is already verified.
 */
export function VerifyEmailBanner({ required }: { required: boolean }) {
  const { data } = useSession()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const user = data?.user

  if (!required || user === undefined || user.emailVerified === true) return null

  const resend = async () => {
    setBusy(true)
    await authClient.sendVerificationEmail({ email: user.email, callbackURL: '/' })
    setBusy(false)
    setSent(true)
  }

  return (
    <div className="mt-6 flex items-center gap-3 rounded-[12px] border border-warn/30 bg-warn/5 px-4 py-3">
      <MailCheck size={16} className="shrink-0 text-warn" aria-hidden="true" />
      <p className="flex-1 text-[13px] leading-relaxed text-fg-2">
        Confirm your email to publish forms and use AI. You can keep building and previewing
        meanwhile.
      </p>
      {sent ? (
        <span className="text-[12.5px] font-medium text-fg-3">Sent, check your inbox.</span>
      ) : (
        <button
          type="button"
          onClick={resend}
          disabled={busy}
          className="shrink-0 rounded-[9px] border border-line bg-surface-2 px-3 py-1.5 text-[12.5px] font-semibold shadow-sm hover:bg-surface-hover disabled:opacity-60"
        >
          {busy ? 'Sending…' : 'Resend email'}
        </button>
      )}
    </div>
  )
}
