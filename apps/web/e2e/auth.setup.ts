// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test as setup } from '@playwright/test'

/** Signs one fresh account up; every spec reuses its session via storageState. */
setup('create the shared e2e account', async ({ page }) => {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  await page.goto('/signup')
  await page.getByLabel('Name').fill('E2E Runner')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('correct-horse-battery')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('button', { name: 'New form' })).toBeVisible({ timeout: 15_000 })
  await page.context().storageState({ path: 'e2e/.auth/state.json' })
})
