// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * S4 definition of done — the AI loop with the deterministic mock provider:
 * generation makes a working draft; the interviewer probes engaged answers;
 * a mid-session provider death degrades to the static fallback with NO
 * visible error (v1 §12 #2, rehearsed); the trace lands in Results.
 */

/** Click the visible answer control, then fill it — typing before focus lands
 * falls on <body>. Excludes the honeypot: opacity:0 still counts as :visible
 * to Playwright, and filling the bait field discards the submission. */
async function typeAnswer(page: import('@playwright/test').Page, text: string) {
  const control = page
    .locator('.fsr-root input:visible:not(.fsr-hp), .fsr-root textarea:visible')
    .first()
  await control.click()
  await control.fill(text)
  await page.keyboard.press('Enter')
}

/** Publish the candidate-screening template and open it live. */
async function liveScreening(page: import('@playwright/test').Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: /Candidate screening/ }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()

  await page.goto(`/f/${formId}`)
  await expect(page.locator('.fsr-root h1')).toContainText('Thanks for applying', {
    timeout: 5_000,
  })
  await page.keyboard.press('Enter')
  await expect(page.locator('.fsr-root h1')).toContainText('Your full name', { timeout: 5_000 })
  await typeAnswer(page, 'Ada Lovelace')
  await expect(page.locator('.fsr-root h1')).toContainText('Best email', { timeout: 5_000 })
  await typeAnswer(page, 'ada@lovelace.dev')
  await expect(page.locator('.fsr-root h1')).toContainText('Phone number', { timeout: 5_000 })
  await page.keyboard.press('Enter') // optional → skip
  await expect(page.locator('.fsr-root h1')).toContainText('Which role', { timeout: 5_000 })
  await page.keyboard.press('a') // Engineering
  await expect(page.locator('.fsr-root h1')).toContainText("project you're proud of", {
    timeout: 5_000,
  })
  return formId
}

async function finishScreening(page: import('@playwright/test').Page) {
  await expect(page.locator('.fsr-root h1')).toContainText('consent', { timeout: 5_000 })
  await page.keyboard.press('a') // I accept
  await expect(page.locator('.fsr-root h1')).toContainText('be in touch', { timeout: 5_000 })
  await expect(page.locator('.fsr-submit-status')).toHaveText('Response recorded.', {
    timeout: 10_000,
  })
}

test('the AI interviewer probes an engaged answer; the verified trace lands in Results', async ({
  page,
}) => {
  const formId = await liveScreening(page)

  // engaged base answer → the mock provider generates follow-up 1
  await typeAnswer(
    page,
    'I rebuilt our deployment pipeline because releases kept failing every Friday',
  )
  await expect(page.locator('.fsr-root h1')).toContainText('mock follow-up', { timeout: 5_000 })
  await expect(page.locator('.fsr-ai-tag')).toContainText('AI-generated question')
  await typeAnswer(
    page,
    'It cut our deploy failures to zero because I automated the rollback checks',
  )

  // maxFollowups=2 on this template → a second question, then the loop ends
  await expect(page.locator('.fsr-root h1')).toContainText('mock follow-up', { timeout: 5_000 })
  await typeAnswer(page, 'Mostly the rollback automation')

  await finishScreening(page)

  // the owner's audit: exchanges under the block, marked verified
  await page.goto(`/forms/${formId}/results`)
  await page.getByRole('button', { name: /responses/i }).click()
  await expect(page.getByText('AI follow-up 1')).toBeVisible()
  await expect(page.getByText('It cut our deploy failures to zero')).toBeVisible()
  await expect(page.getByText(/verified/).first()).toBeVisible()
})

test('§12 #2: provider death mid-session → the static fallback, NO visible error', async ({
  page,
}) => {
  const formId = await liveScreening(page)

  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))

  // the FAIL_AI trigger kills the mock provider for this generation call
  await typeAnswer(page, 'I am proud of the FAIL_AI migration project I led last year')

  // the template's static fallbackQuestion appears seamlessly — as follow-up #1
  await expect(page.locator('.fsr-root h1')).toContainText(
    'What was your specific role in that project',
    { timeout: 5_000 },
  )
  await typeAnswer(page, 'I led the FAIL_AI team of four') // index 2 also fails → loop ends quietly

  await finishScreening(page)
  expect(errors).toEqual([]) // no visible error state, no crash

  // the trace records the degradation honestly
  await page.goto(`/forms/${formId}/results`)
  await page.getByRole('button', { name: /responses/i }).click()
  await expect(page.getByText('AI follow-up 1')).toBeVisible()
  await expect(page.getByText('fallback')).toBeVisible()
})

test('AI form generation: prompt → draft in the builder → publishes clean', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Describe your form').fill('customer feedback for a bakery')
  await page.getByRole('button', { name: 'Generate' }).click()

  // the mock returns a canned valid form; we land in the builder on the draft
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/, { timeout: 15_000 })
  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()
  await expect(page.locator('[data-rail-row="name"]')).toContainText('What is your name?')

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()
})
