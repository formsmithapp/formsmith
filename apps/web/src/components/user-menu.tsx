// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { useQuery } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

interface Me {
  user: { name: string; email: string }
  workspace: { id: string; name: string; role: string } | null
}

/** The signed-in cluster: workspace name, avatar initial, sign out. */
export function UserMenu() {
  const router = useRouter()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<Me | null> => {
      const res = await fetch('/api/me')
      return res.ok ? ((await res.json()) as Me) : null
    },
    staleTime: 60_000,
  })

  if (!me.isSuccess || me.data === null) return null
  const initial = (me.data.user.name || me.data.user.email).slice(0, 1).toUpperCase()

  return (
    <span className="flex items-center gap-2.5">
      {me.data.workspace !== null && (
        <span data-workspace-name className="eyebrow max-w-44 truncate text-fg-3">
          {me.data.workspace.name}
        </span>
      )}
      <span
        aria-hidden="true"
        title={me.data.user.email}
        className="grid size-7 place-items-center rounded-full bg-brand-soft font-mono text-[12px] font-semibold text-brand"
      >
        {initial}
      </span>
      <button
        type="button"
        aria-label="Sign out"
        onClick={async () => {
          await authClient.signOut()
          router.push('/signin')
          router.refresh()
        }}
        className="grid size-7 place-items-center rounded-md text-fg-3 transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <LogOut size={13} />
      </button>
    </span>
  )
}
