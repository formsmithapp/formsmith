// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vitest/config'

// The same suite runs twice — real Node and a real Chromium — as the
// engine's isomorphism proof. Fixtures and assertions are shared verbatim.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        // Pre-bundle the rules evaluator so a cold cache doesn't reload mid-run.
        optimizeDeps: {
          include: ['@formsmithapp/rules > json-logic-engine'],
        },
        test: {
          name: 'browser',
          include: ['src/**/*.test.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: 'playwright',
            screenshotFailures: false,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
