// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * S2 definition of done — the link works for OTHER PEOPLE: a respondent with
 * no session and no localStorage completes the form; the response lands in
 * the owner's Results with server-recomputed variables. Plus the local-first
 * import path.
 */

test('a fresh anonymous context completes /f/:id; the owner sees the verified response', async ({
  page,
  browser,
}) => {
  // owner: quiz from the template, published
  await page.goto('/')
  await page.getByRole('button', { name: /Scored quiz/ }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()

  // respondent: FRESH context — no cookies, no storage, nothing shared
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const respondent = await anon.newPage()
  await respondent.goto(`/f/${formId}`)
  await expect(respondent.locator('.fsr-root h1')).toContainText('The pop quiz', {
    timeout: 5_000,
  })
  await respondent.keyboard.press('Enter')
  await expect(respondent.locator('.fsr-root h1')).toContainText('What is 2 + 2?', {
    timeout: 5_000,
  })
  await respondent.keyboard.press('b')
  await expect(respondent.locator('.fsr-root h1')).toContainText('Capital of France?', {
    timeout: 5_000,
  })
  await respondent.keyboard.press('b')
  await expect(respondent.locator('.fsr-root h1')).toContainText('Closest planet', {
    timeout: 5_000,
  })
  await respondent.keyboard.press('b')
  await expect(respondent.locator('.fsr-root h1')).toContainText('30 points — you passed!', {
    timeout: 5_000,
  })
  await expect(respondent.locator('.fsr-submit-status')).toHaveText('Response recorded.', {
    timeout: 10_000,
  })
  await anon.close()

  // owner: the response is there, score recomputed by the server
  await page.goto(`/forms/${formId}/results`)
  await page.getByRole('button', { name: /responses/i }).click()
  await expect(page.getByText(/Σ score = 30/)).toBeVisible()
})

test('localStorage-era forms import into the workspace with their snapshots', async ({ page }) => {
  // seed a pre-S2 local form (draft doc + published v1 snapshot)
  await page.goto('/')
  const sourceId = await page.evaluate(() => {
    const id = crypto.randomUUID()
    const doc = {
      id,
      title: 'Legacy local form',
      blocks: [
        { id: 'b1', ref: 'welcome', type: 'welcome', title: 'Old but gold', required: false },
        { id: 'b2', ref: 'name', type: 'short_text', title: 'Name?', required: false },
        { id: 'b3', ref: 'thanks', type: 'thankyou', title: 'Bye', required: false },
      ],
      logic: [],
      variables: [],
      settings: {},
    }
    localStorage.setItem(
      `fs.form.${id}`,
      JSON.stringify({
        form: doc,
        status: 'published',
        publishedVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    )
    localStorage.setItem(`fs.form.${id}.v1`, JSON.stringify({ ...doc, version: 1 }))
    localStorage.setItem(
      'fs.forms',
      JSON.stringify([{ id, title: 'Legacy local form', status: 'published' }]),
    )
    return id
  })
  await page.reload()

  await expect(page.getByText(/1 form lives? only in this browser/)).toBeVisible()
  await page.getByRole('button', { name: 'Import' }).click()

  // banner gone, local keys cleaned, the form is in the workspace list
  await expect(page.getByText(/lives? only in this browser/)).toHaveCount(0)
  await expect(page.getByText('Legacy local form')).toBeVisible()
  const cleaned = await page.evaluate(
    (id) => localStorage.getItem(`fs.form.${id}`) === null,
    sourceId,
  )
  expect(cleaned).toBe(true)
})
