// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * S5 definition of done — the hardening is real: the honeypot silently
 * discards bot submissions, the header split protects the dashboard while
 * keeping /f/:id frameable, the badge ships on by default, and /api/health
 * answers for Docker/monitors.
 */

async function publishQuiz(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: /Scored quiz/ }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()
  return formId
}

test('honeypot: a filled hidden field gets success-shaped handling but stores NOTHING', async ({
  page,
}) => {
  const formId = await publishQuiz(page)

  await page.goto(`/f/${formId}`)
  await expect(page.locator('.fsr-root h1')).toContainText('The pop quiz', { timeout: 5_000 })
  // what a naive bot does: fill every input it can find, including the bait
  await page
    .locator('.fsr-hp')
    .evaluate((el) => ((el as HTMLInputElement).value = 'https://spam.example'))
  await page.keyboard.press('Enter')
  await expect(page.locator('.fsr-root h1')).toContainText('What is 2 + 2?', { timeout: 5_000 })
  await page.keyboard.press('b')
  await expect(page.locator('.fsr-root h1')).toContainText('Capital of France?', {
    timeout: 5_000,
  })
  await page.keyboard.press('b')
  await expect(page.locator('.fsr-root h1')).toContainText('Closest planet', { timeout: 5_000 })
  await page.keyboard.press('b')
  // indistinguishable from success for the bot…
  await expect(page.locator('.fsr-submit-status')).toHaveText('Response recorded.', {
    timeout: 10_000,
  })

  // …but the owner's Results has nothing
  await page.goto(`/forms/${formId}/results`)
  await expect(page.getByRole('heading', { name: 'No responses yet' })).toBeVisible()
})

test('security headers: dashboard refuses framing, /f/:id stays embeddable', async ({ page }) => {
  const formId = await publishQuiz(page)

  const dashboard = await page.request.get('/')
  expect(dashboard.headers()['x-frame-options']).toBe('DENY')
  expect(dashboard.headers()['x-content-type-options']).toBe('nosniff')
  expect(dashboard.headers()['content-security-policy']).toContain("default-src 'self'")

  const live = await page.request.get(`/f/${formId}`)
  expect(live.headers()['x-frame-options']).toBeUndefined() // frameable on purpose
  expect(live.headers()['x-content-type-options']).toBe('nosniff')
})

test('the "Powered by Formsmith" badge ships ON by default', async ({ page }) => {
  const formId = await publishQuiz(page)
  await page.goto(`/f/${formId}`)
  await expect(page.locator('.fsr-root')).toBeVisible()
  await expect(page.getByText('Powered by')).toBeVisible()
})

test('/api/health reports ok + version (the Docker HEALTHCHECK target)', async ({ page }) => {
  const res = await page.request.get('/api/health')
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { status: string; version: string }
  expect(body.status).toBe('ok')
  expect(body.version).toBeTruthy()
})
