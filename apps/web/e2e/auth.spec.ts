// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * S1 definition of done: single-step sign-up (name+email+password) → the
 * dashboard with an auto-created personal workspace → sign out/in; anonymous
 * visitors are gated off the dashboard while /f/:id stays public.
 */
test.use({ storageState: { cookies: [], origins: [] } }) // anonymous — no shared session

test('anonymous visitors are redirected to /signin; /f stays public', async ({ page }) => {
  await page.goto('/')
  await page.waitForURL(/\/signin/)
  await expect(page.getByRole('heading', { name: 'Sign in to Formsmith' })).toBeVisible()

  await page.goto('/forms/whatever/create')
  await page.waitForURL(/\/signin/)

  // the respondent surface is NOT gated
  await page.goto('/f/does-not-exist')
  await expect(page.getByText("This form isn't available")).toBeVisible()
})

test('single-step sign-up → workspace auto-created → sign out → sign in', async ({ page }) => {
  const email = `ada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
  const password = 'correct-horse-battery'

  // one form, three fields — no verification step
  await page.goto('/signup')
  await page.getByLabel('Name').fill('Ada Lovelace')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()

  // straight to the dashboard, personal workspace already there
  await expect(page.getByRole('button', { name: 'New form' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-workspace-name]')).toHaveText("Ada Lovelace's workspace")

  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/signin/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.locator('[data-workspace-name]')).toHaveText("Ada Lovelace's workspace", {
    timeout: 15_000,
  })

  // wrong password fails inline, no redirect
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/signin/)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('wrong-password-entirely')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
})
