// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vitest/config'

/**
 * Component tests run in real Chromium against the ALIASED preact/compat
 * build — the exact runtime respondents get (the builder's real-React path
 * is exercised by apps/web later). Node project hosts the framework-free
 * units (submission queue) and the bundle-budget check.
 */
const preactAliases = {
  react: 'preact/compat',
  'react-dom/client': 'preact/compat/client',
  'react-dom': 'preact/compat',
  'react/jsx-runtime': 'preact/compat/jsx-runtime',
  'react/jsx-dev-runtime': 'preact/compat/jsx-dev-runtime',
}

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
        resolve: { alias: preactAliases },
        optimizeDeps: {
          include: [
            'preact/compat',
            'preact/compat/client',
            'preact/compat/jsx-runtime',
            '@formsmithapp/engine > @formsmithapp/blocks/runtime',
            '@formsmithapp/engine > @formsmithapp/rules > json-logic-engine',
          ],
        },
        test: {
          name: 'browser',
          include: ['src/**/*.test.tsx'],
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
