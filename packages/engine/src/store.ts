// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The universal reactive contract — the bridge to every framework:
 * React `useSyncExternalStore(subscribe, getState)`, the Svelte store contract,
 * a Vue/Solid composable. Hand-rolled; zero dependencies.
 */
export interface EngineStore<S> {
  /** Current immutable snapshot — a new object on every change. */
  getState(): S
  /** Subscribe to changes. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

export interface InternalStore<S> extends EngineStore<S> {
  setState(next: S): void
}

export function createStore<S>(initial: S): InternalStore<S> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    getState: () => state,
    setState(next: S) {
      state = next
      for (const listener of [...listeners]) listener()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
