// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { deriveTheme, parseThemeConfig, resolveAppearance } from '@formsmithapp/ui'
import { useEffect, useMemo, useState } from 'react'

export function useSystemDark(): boolean {
  const [dark, setDark] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return dark
}

export interface FormTheming {
  /** The resolved ground ('auto' follows the system, live). */
  appearance: 'light' | 'dark'
  /** Flat CSS-var map for that ground — inline-applied wherever the form shows. */
  vars: Record<string, string>
}

/**
 * Resolves a form document's theme for the canvas and preview. Returns null
 * for untouched forms (no `theme` on the doc) so they keep the exact stock
 * tokens instead of a formula-derived approximation of them.
 */
export function useFormTheming(theme: Record<string, unknown> | undefined): FormTheming | null {
  const systemDark = useSystemDark()
  return useMemo(() => {
    if (theme === undefined) return null
    const config = parseThemeConfig(theme)
    const appearance = resolveAppearance(config.appearance, systemDark)
    return { appearance, vars: deriveTheme(config)[appearance] }
  }, [theme, systemDark])
}
