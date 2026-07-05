// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { describe, expect, it } from 'vitest'
import { ENGINE_PACKAGE } from './index'

// Pipeline smoke test — proves the build/test harness works end to end.
// Replace with real engine tests when implementation begins.
describe('@formsmithapp/engine (scaffold)', () => {
  it('exposes its package identity', () => {
    expect(ENGINE_PACKAGE).toBe('@formsmithapp/engine')
  })
})
