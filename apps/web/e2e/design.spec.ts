// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * M3 definition of done: brand the form in the Design tab → the canvas
 * restyles live → the preview runtime carries the derived vars → publish
 * pins the theme into the snapshot.
 */
test('design tab themes canvas + preview live, publish pins the theme', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/([0-9a-f-]+)\/create/)
  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1] ?? ''

  const panel = page.locator('aside').last()
  const stage = page.locator('main')

  // stock form: no theme, no inline overrides on the stage
  await expect(stage).not.toHaveAttribute('data-theme', /.+/)

  // brand it violet on a dark ground, set the literary pair
  await panel.getByRole('tab', { name: /design/i }).click()
  await panel.getByRole('button', { name: 'Brand swatch Violet' }).click()
  await panel.getByRole('radio', { name: /^dark$/i }).click()
  await panel.getByRole('button', { name: /Literary/ }).click()

  // the canvas re-tokens itself to the form's theme, live
  await expect(stage).toHaveAttribute('data-theme', 'dark')
  const stageVars = await stage.evaluate((el) => ({
    brand: el.style.getPropertyValue('--brand'),
    serif: el.style.getPropertyValue('--font-serif'),
  }))
  expect(stageVars.brand).toMatch(/^#[0-9a-f]{6}$/)
  expect(stageVars.serif).toContain('Newsreader')

  // preview: the runtime root carries the same derived vars + appearance
  await page.getByRole('button', { name: 'Preview' }).click()
  const root = page.locator('.fsr-root')
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute('data-theme', 'dark')
  const rootVars = await root.evaluate((el) => ({
    brand: (el as HTMLElement).style.getPropertyValue('--brand'),
    serif: (el as HTMLElement).style.getPropertyValue('--font-serif'),
  }))
  expect(rootVars.brand).toBe(stageVars.brand)
  expect(rootVars.serif).toContain('Newsreader')
  await page.keyboard.press('Escape')

  // publish pins the theme in the immutable snapshot
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()
  const snapshot = await (await page.request.get(`/api/v1/forms/${formId}/versions/1`)).json()
  expect(snapshot?.form?.theme).toMatchObject({
    brandColor: '#7048e8',
    appearance: 'dark',
    fontPair: 'literary',
  })
})
