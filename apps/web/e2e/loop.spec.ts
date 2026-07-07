// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

/**
 * M4 definition of done — the whole product loop with no server: template →
 * publish → fill at /f/:id (keyboard-only, themed) → response in Results
 * (summary + detail) → CSV export → Share link.
 */
test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

test('the full local-first loop: template → publish → /f/:id → results → export → share', async ({
  page,
}) => {
  // 1 · dashboard → scored-quiz template → builder
  await page.goto('/')
  await page.getByRole('button', { name: /Scored quiz/ }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''
  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()
  await expect(page.locator('[data-rail-row="q1"]')).toContainText('What is 2 + 2?')

  // 2 · publish v1 (no edits needed — publish flushes any pending save itself)
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()

  // 3 · the live form — themed (violet on dark) and keyboard-only completable
  await page.goto(`/f/${formId}`)
  const root = page.locator('.fsr-root')
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-theme', 'dark') // the template's theme, not the chrome's
  expect(
    await root.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--brand')),
  ).toMatch(/^#[0-9a-f]{6}$/)
  await expect(page.locator('.fsr-root h1')).toContainText('The pop quiz', { timeout: 5_000 })
  await page.keyboard.press('Enter')
  await expect(page.locator('.fsr-root h1')).toContainText('What is 2 + 2?', { timeout: 5_000 })
  await page.keyboard.press('b') // 4
  await expect(page.locator('.fsr-root h1')).toContainText('Capital of France?', {
    timeout: 5_000,
  })
  await page.keyboard.press('b') // Paris
  await expect(page.locator('.fsr-root h1')).toContainText('Closest planet', { timeout: 5_000 })
  await page.keyboard.press('b') // Mercury
  await expect(page.locator('.fsr-root h1')).toContainText('30 points — you passed!', {
    timeout: 5_000,
  })
  // the submission went through the retry queue into the responses store
  await expect(page.locator('.fsr-submit-status')).toHaveText('Response recorded.', {
    timeout: 10_000,
  })

  // 4 · Results: summary aggregates it, detail shows the verified trail
  await page.goto(`/forms/${formId}/results`)
  await expect(page.getByRole('heading', { name: 'What is 2 + 2?' })).toBeVisible()
  const q1Card = page.locator('section', { hasText: 'What is 2 + 2?' }).first()
  await expect(q1Card).toContainText('1 answer')
  await page.getByRole('button', { name: /responses/i }).click()
  // regex, not string: Playwright's case-insensitive string matching chokes
  // on Σ (Greek sigma has two lowercase forms — its case-folding never matches)
  await expect(page.getByText(/Σ score = 30/)).toBeVisible() // recomputed, not client-claimed
  await expect(page.getByText('Mercury', { exact: true })).toBeVisible()

  // 5 · CSV export contains the row (raw ids — round-trippable)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    // the export is now a native streaming download link (role: link, not button)
    page.getByRole('link', { name: 'CSV' }).click(),
  ])
  const csvPath = await download.path()
  const csv = readFileSync(csvPath, 'utf8')
  expect(csv.split('\n')[0]).toBe('q1,q2,q3,submitted_at,version')
  expect(csv).toContain('four,paris,mercury')

  // 6 · Share: the live link is there and copies
  await page.goto(`/forms/${formId}/share`)
  await expect(page.getByText(`/f/${formId}`).first()).toBeVisible()
  await page.getByRole('button', { name: 'Copy live link' }).click()
  await expect(page.getByRole('button', { name: 'Copy live link' })).toContainText('Copied')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toContain(`/f/${formId}`)
})

test('/f/:id for an unpublished form shows the friendly unavailable state', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''

  await page.goto(`/f/${formId}`)
  await expect(page.getByText("This form isn't available")).toBeVisible()
  await page.goto('/f/does-not-exist')
  await expect(page.getByText("This form isn't available")).toBeVisible()
})
