// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
'use client'

import { createContext, useContext, useSyncExternalStore } from 'react'
import type { BuilderState, BuilderStore } from '@/lib/builder-store'

const BuilderContext = createContext<BuilderStore | null>(null)

export const BuilderProvider = BuilderContext.Provider

export function useBuilder(): BuilderStore {
  const store = useContext(BuilderContext)
  if (store === null) throw new Error('useBuilder needs a <BuilderProvider>')
  return store
}

export function useBuilderState(): BuilderState {
  const store = useBuilder()
  return useSyncExternalStore(store.subscribe, store.getState, store.getState)
}
