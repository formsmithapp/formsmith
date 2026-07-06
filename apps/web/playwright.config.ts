// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from '@playwright/test'

/**
 * e2e prerequisites: the dev Postgres from the repo root —
 *   docker compose -f compose.dev.yml up -d
 * A `setup` project signs one account up and shares its storageState with
 * every spec; auth.spec.ts opts back out to test the anonymous paths.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:3105' },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/state.json' },
    },
  ],
  webServer: {
    command: 'pnpm dev --port 3105',
    url: 'http://localhost:3105',
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://formsmith:formsmith@localhost:5432/formsmith',
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'e2e-only-secret-not-for-production',
      BETTER_AUTH_URL: 'http://localhost:3105',
      FORMSMITH_AI: 'mock', // deterministic provider; 'FAIL_AI' in an answer kills it
      WEBHOOK_ALLOW_PRIVATE: 'true', // the webhook e2e listener runs on 127.0.0.1
    },
  },
})
