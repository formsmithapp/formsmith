// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  use: { baseURL: 'http://localhost:3105' },
  webServer: {
    command: 'pnpm dev --port 3105',
    url: 'http://localhost:3105',
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
