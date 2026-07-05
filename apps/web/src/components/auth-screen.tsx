// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { BrandMark } from './brand-mark'

export interface SocialProviders {
  google: boolean
  github: boolean
}

const inputClass =
  'w-full rounded-[9px] border border-line bg-surface-2 px-3 py-2 text-[14px] outline-none transition-shadow focus:border-brand-ring focus:shadow-[0_0_0_3px_var(--brand-soft)]'

/**
 * The premium auth screens on Better Auth primitives (lld: no default UI).
 * Sign-up is single-step — name + email + password — and the personal
 * workspace is bootstrapped server-side on creation.
 */
export function AuthScreen({
  mode,
  providers,
}: {
  mode: 'signin' | 'signup'
  providers: SocialProviders
}) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'
  const anySocial = providers.google || providers.github

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    const result = signup
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password })
    setBusy(false)
    if (result.error) {
      setError(result.error.message ?? 'Something went wrong — try again.')
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <div className="relative grid h-dvh place-items-center bg-canvas px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:var(--canvas-vignette)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <BrandMark />
        </div>
        <div className="mt-6 rounded-[16px] border border-line bg-surface-2 p-6 shadow-md">
          <p className="eyebrow text-brand">{signup ? 'Get started' : 'Welcome back'}</p>
          <h1 className="mt-2 font-serif text-[24px] font-semibold tracking-[-0.012em]">
            {signup ? 'Create your workspace' : 'Sign in to Formsmith'}
          </h1>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {signup && (
              <label className="block">
                <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-fg-2 uppercase">
                  Name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoComplete="name"
                  className={inputClass}
                />
              </label>
            )}
            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-fg-2 uppercase">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block font-mono text-[11px] font-semibold tracking-[0.06em] text-fg-2 uppercase">
                Password
              </span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete={signup ? 'new-password' : 'current-password'}
                className={inputClass}
              />
            </label>
            {error !== null && (
              <p role="alert" className="text-[12.5px] text-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-brand px-4 py-2.5 text-[14px] font-semibold text-on-brand shadow-sm transition-transform duration-100 ease-spring hover:bg-brand-strong active:scale-[0.98] disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {signup ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {anySocial && (
            <>
              <div className="my-4 flex items-center gap-3 text-[11px] text-fg-3">
                <span className="h-px flex-1 bg-line-soft" /> or{' '}
                <span className="h-px flex-1 bg-line-soft" />
              </div>
              <div className="grid gap-2">
                {providers.google && (
                  <button
                    type="button"
                    onClick={() =>
                      authClient.signIn.social({ provider: 'google', callbackURL: '/' })
                    }
                    className="rounded-[9px] border border-line bg-surface px-4 py-2 text-[13.5px] font-medium hover:bg-surface-hover"
                  >
                    Continue with Google
                  </button>
                )}
                {providers.github && (
                  <button
                    type="button"
                    onClick={() =>
                      authClient.signIn.social({ provider: 'github', callbackURL: '/' })
                    }
                    className="rounded-[9px] border border-line bg-surface px-4 py-2 text-[13.5px] font-medium hover:bg-surface-hover"
                  >
                    Continue with GitHub
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[13px] text-fg-2">
          {signup ? 'Already have an account? ' : 'New to Formsmith? '}
          <Link href={signup ? '/signin' : '/signup'} className="font-semibold text-brand">
            {signup ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </div>
    </div>
  )
}
