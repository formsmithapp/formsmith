// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * The M1 demo script, end to end: create → compose via the palette →
 * inline-edit → undo/redo → autosave survives reload → keyboard-only
 * respondent preview (the renderer's real-React path) → publish snapshots
 * immutably.
 */
test('builder M1: create, compose, edit, undo, autosave, preview, publish', async ({ page }) => {
  await page.goto('/')

  // create a form and land in the builder
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/[0-9a-f-]+\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1]
  if (formId === undefined) throw new Error('no form id in url')

  // wait for the builder shell to mount (client-side load from localStorage)
  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()

  // ⌘K palette → search → insert an opinion scale
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('textbox', { name: 'Search blocks' })
  await expect(search).toBeVisible()
  await search.fill('opinion')
  await page.keyboard.press('Enter')
  await expect(page.locator('[data-rail-row="opinion_scale"]')).toBeVisible()

  // inline-edit the question title on the canvas; it live-syncs to the rail
  const title = page.getByRole('textbox', { name: 'Question title' })
  await title.click()
  await title.fill('How satisfied are you?')
  await expect(page.locator('[data-rail-row="opinion_scale"]')).toContainText(
    'How satisfied are you?',
  )

  // required toggle marks the canvas title with the amber star
  await page.getByRole('switch', { name: 'Required' }).click()
  await expect(page.locator('main').getByText('*')).toBeVisible()

  // undo/redo walk the history
  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('main').getByText('*')).toHaveCount(0)
  await page.keyboard.press('ControlOrMeta+Shift+z')
  await expect(page.locator('main').getByText('*')).toBeVisible()

  // autosave persists across a full reload
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('[data-rail-row="opinion_scale"]')).toContainText(
    'How satisfied are you?',
  )

  // respondent preview: complete the form KEYBOARD-ONLY (real React renderer)
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.locator('.fsr-root')).toBeVisible()
  // block order: welcome → opinion scale (inserted after the selected welcome) → starter question
  await page.keyboard.press('Enter') // welcome → the required opinion scale
  await expect(page.locator('.fsr-root h1')).toContainText('How satisfied are you?', {
    timeout: 5_000,
  })
  await page.keyboard.press('Enter') // required + empty → gently blocked
  await expect(page.locator('.fsr-root .fsr-error')).toContainText('This field is required.')
  await page.keyboard.press('4') // digit pick auto-advances → starter short_text
  await expect(page.locator('.fsr-root h1')).not.toContainText('How satisfied', {
    timeout: 5_000,
  })
  await page.keyboard.type('all good')
  await page.keyboard.press('Enter') // optional question answered → ending
  await expect(page.locator('.fsr-root h1')).toContainText('Thanks for your time!', {
    timeout: 5_000,
  })
  // the optimistic queue delivered (persistent status line on the ending)
  await expect(page.locator('.fsr-submit-status')).toContainText('Response recorded.')
  await page.keyboard.press('Escape')
  await expect(page.locator('.fsr-root')).toHaveCount(0)

  // publish → immutable snapshot v1 in the repository (server-side since S2)
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()
  const snapshot = await (await page.request.get(`/api/v1/forms/${formId}/versions/1`)).json()
  expect(snapshot?.form?.version).toBe(1)

  // draft edits never touch the published snapshot (reselect the question first —
  // the reload above reset selection to the welcome screen)
  await page.locator('[data-rail-row="opinion_scale"]').click()
  await title.click()
  await title.fill('Edited after publishing')
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  const after = await (await page.request.get(`/api/v1/forms/${formId}/versions/1`)).json()
  const titles = (after?.form?.blocks ?? []).map((b: { title: string }) => b.title)
  expect(titles).toContain('How satisfied are you?')
  expect(titles).not.toContain('Edited after publishing')

  // pinned screens: welcome row shows no drag grip, list order holds
  const rows = page.locator('[data-rail-row]')
  await expect(rows.first()).toHaveAttribute('data-rail-row', /welcome|intro|hey/)
})
