// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { createEngine, type FormDefinition, type FormEngine } from '@formsmithapp/engine'
import { useMemo, useRef } from 'react'

/**
 * Last-good edit-mode engine — resolves {{tokens}} and visibility with
 * initial variables and no answers. While the doc is mid-edit invalid, the
 * previous engine is kept so dependent UI (piped hints, rail dimming) never
 * flickers to nothing.
 */
export function useEditEngine(doc: FormDefinition): FormEngine | null {
  const lastEngine = useRef<FormEngine | null>(null)
  return useMemo(() => {
    try {
      lastEngine.current = createEngine(doc, { mode: 'edit' })
    } catch {
      // keep the previous engine while the doc is mid-edit invalid
    }
    return lastEngine.current
  }, [doc])
}
