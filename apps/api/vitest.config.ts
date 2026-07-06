// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Each test spins a fresh PGlite + runs all migrations for full isolation.
    // The first hook in a worker also pays the one-time WASM compile; on slower,
    // contended CI runners that cold start alone can exceed vitest's 10s default.
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
})
