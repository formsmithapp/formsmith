// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

/**
 * Full-page accessibility regression, run in a real browser after real
 * interaction. Complements the component-level axe scan in the renderer's
 * runtime.test.tsx: this one covers the whole page (landmarks, lang, tab order)
 * and the builder, which the component tests cannot. Gate: no critical or
 * serious violations. Everything else (SR flow, contrast judgment) is manual.
 */

const BLOCKING = new Set(['critical', 'serious'])

async function scan(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((v) => BLOCKING.has(v.impact ?? ''))
  const summary = blocking
    .map((v) => `  - ${v.id} (${v.impact}) x${v.nodes.length}: ${v.help}`)
    .join('\n')
  expect(blocking, `${context} has blocking a11y violations:\n${summary}`).toEqual([])
}

/** New form, land in the builder, and add one answerable question. */
async function createFormWithQuestion(page: Page): Promise<string> {
  await page.goto('/')
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/[0-9a-f-]+\/create/)
  const formId = /\/forms\/([0-9a-f-]+)\/create/.exec(page.url())?.[1]
  if (formId === undefined) throw new Error('no form id in url')

  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()
  await page.keyboard.press('ControlOrMeta+k')
  const search = page.getByRole('combobox', { name: 'Search blocks' })
  await expect(search).toBeVisible()
  await search.fill('short')
  await page.keyboard.press('Enter')

  const title = page.getByRole('textbox', { name: 'Question title' })
  await title.click()
  await title.fill('What is your name?')
  return formId
}

test('a11y: the builder page has no critical/serious axe violations', async ({ page }) => {
  await createFormWithQuestion(page)
  await scan(page, 'builder /forms/:id/create')
})

test('a11y: a published respondent page has no critical/serious axe violations', async ({
  page,
}) => {
  const formId = await createFormWithQuestion(page)

  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText(/Published v1/)).toBeVisible()

  await page.goto(`/f/${formId}`)
  await expect(page.locator('.fsr-root')).toBeVisible()
  await scan(page, 'published /f/:id')
})
