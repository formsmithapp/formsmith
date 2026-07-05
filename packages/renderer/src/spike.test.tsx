// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { createEngine } from '@formsmithapp/engine'
import { useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it } from 'vitest'

// De-risk spike: React-API component code running on aliased preact/compat,
// bound to the real engine store via useSyncExternalStore, in real Chromium.
function Probe({ engine }: { engine: ReturnType<typeof createEngine> }) {
  const state = useSyncExternalStore(engine.subscribe, engine.getState, engine.getState)
  return <output data-testid="answer">{String(state.answers.q1 ?? 'none')}</output>
}

it('preact/compat + useSyncExternalStore + engine store work together', async () => {
  const engine = createEngine({
    id: 'spike',
    blocks: [{ id: 'b1', ref: 'q1', type: 'short_text', title: 'Q1' }],
  })
  const host = document.createElement('div')
  document.body.appendChild(host)
  createRoot(host).render(<Probe engine={engine} />)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  expect(host.textContent).toBe('none')

  engine.setAnswer('q1', 'hello')
  await new Promise((resolve) => requestAnimationFrame(resolve))
  expect(host.textContent).toBe('hello')
  host.remove()
})
