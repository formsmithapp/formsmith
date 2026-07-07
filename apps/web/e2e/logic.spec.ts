// Copyright (C) 2026 Gnana Siva Sai V and Formsmith contributors
// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from '@playwright/test'

/**
 * M2 definition of done (v1 §12 #9): the scored quiz authored ENTIRELY
 * through the builder UI — scoring rules, a score-branched jump, piped
 * {{score}} endings — then previewed through both outcomes.
 */
test('author the scored quiz in the UI: scoring, jump-on-score, piped endings', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/[0-9a-f-]+\/create/)
  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()

  const rail = (ref: string) => page.locator(`[data-rail-row="${ref}"]`)
  const logicSection = page.locator('section', { hasText: 'Logic' })
  const scoringSection = page.locator('section', { hasText: 'Scoring' })

  // drop the starter question; keep welcome + ending
  await rail('short_text').click()
  await page.locator('aside').last().getByRole('button', { name: 'Delete block' }).click()

  // Q1: multiple choice with 3 / 4
  await rail('welcome').click()
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Search blocks' }).fill('multiple')
  await page.keyboard.press('Enter')
  const title = page.getByRole('textbox', { name: 'Question title' })
  await title.click()
  await title.fill('What is 2 + 2?')
  await page.getByRole('textbox', { name: 'Choice 1 label' }).fill('3')
  await page.getByRole('textbox', { name: 'Choice 2 label' }).fill('4')

  // scoring: create the variable, add a rule, point it at the right answer
  await scoringSection.getByRole('button', { name: /Create a “score” variable/ }).click()
  await scoringSection.getByRole('button', { name: '+ Add scoring rule' }).click()
  await scoringSection.getByLabel('Condition value').selectOption({ label: '4' })
  await expect(rail('multiple_choice')).toContainText('What is 2 + 2?')

  // Q2: duplicate (deep-clones the scoring rule, self-refs rewritten)
  await page.locator('aside').last().getByRole('button', { name: 'Duplicate block' }).click()
  await title.click()
  await title.fill('Capital of France?')
  await page.getByRole('textbox', { name: 'Choice 1 label' }).fill('London')
  await page.getByRole('textbox', { name: 'Choice 2 label' }).fill('Paris')
  await expect(scoringSection.getByLabel('Scoring amount')).toHaveValue('10')

  // endings: retitle the fail ending, add a pass ending
  await rail('thankyou').click()
  const screenTitle = page.getByRole('textbox', { name: 'Screen title' })
  await screenTitle.click()
  await screenTitle.fill('Only {{score}} points.')
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Search blocks' }).fill('thank')
  await page.keyboard.press('Enter')
  await screenTitle.click()
  await screenTitle.fill('Great — {{score}} points!')

  // jump on Q2: when score ≥ 20 → pass ending (otherwise falls to the fail ending)
  await rail('multiple_choice_2').click()
  await logicSection.getByRole('button', { name: '+ Add jump' }).click()
  await logicSection.getByRole('button', { name: '+ Add condition' }).nth(1).click()
  await logicSection.getByLabel('Condition field').selectOption({ label: 'Σ score' })
  await logicSection.getByLabel('Condition value').fill('20')
  await logicSection
    .getByLabel('Jump destination')
    .selectOption({ label: 'Great — {{score}} points!' })

  // preview: PASS path (4, Paris → 20 points)
  await expect(page.getByText('Saved', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Preview' }).click()
  await expect(page.locator('.fsr-root')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.locator('.fsr-root h1')).toContainText('What is 2 + 2?', { timeout: 5_000 })
  await page.keyboard.press('b') // "4"
  await expect(page.locator('.fsr-root h1')).toContainText('Capital of France?', {
    timeout: 5_000,
  })
  await page.keyboard.press('b') // "Paris"
  await expect(page.locator('.fsr-root h1')).toContainText('Great — 20 points!', {
    timeout: 5_000,
  })
  await page.keyboard.press('Escape')

  // preview: FAIL path (3, London → 0 points, falls through to the fail ending)
  await page.getByRole('button', { name: 'Preview' }).click()
  await page.keyboard.press('Enter')
  await expect(page.locator('.fsr-root h1')).toContainText('What is 2 + 2?', { timeout: 5_000 })
  await page.keyboard.press('a')
  await expect(page.locator('.fsr-root h1')).toContainText('Capital of France?', {
    timeout: 5_000,
  })
  await page.keyboard.press('a')
  await expect(page.locator('.fsr-root h1')).toContainText('Only 0 points.', { timeout: 5_000 })
  await page.keyboard.press('Escape')

  // and it publishes
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText('Published v1 — snapshot saved')).toBeVisible()
})

test('visibility + hidden fields: authored in the UI, honored in preview', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New form' }).click()
  await page.waitForURL(/\/forms\/[0-9a-f-]+\/create/)
  await expect(page.getByRole('button', { name: /Add block/ })).toBeVisible()

  // yes/no before the starter question
  await page.locator('[data-rail-row="welcome"]').click()
  await page.keyboard.press('ControlOrMeta+k')
  await page.getByRole('combobox', { name: 'Search blocks' }).fill('yes')
  await page.keyboard.press('Enter')
  const title = page.getByRole('textbox', { name: 'Question title' })
  await title.click()
  await title.fill('Any feedback?')

  // starter question becomes conditional on Yes
  await page.locator('[data-rail-row="short_text"]').click()
  await title.click()
  await title.fill('Tell us more')
  const logicSection = page.locator('section', { hasText: 'Logic' })
  await logicSection.getByRole('button', { name: '+ Add condition' }).first().click()
  // default condition: yes_no is Yes — with no answer yet the block is hidden
  // from a fresh start, so the rail dims it with the eye-off glyph (M4-D6)
  await expect(
    page.locator('[data-rail-row="short_text"] [aria-label="Hidden until its rule matches"]'),
  ).toBeVisible()

  // hidden field via the settings sheet, piped into the welcome title
  await page.getByRole('button', { name: 'Form settings' }).click()
  await page.getByRole('textbox', { name: 'New hidden field name' }).fill('visitor')
  await page.getByRole('button', { name: 'Add' }).nth(1).click()
  await page.keyboard.press('Escape')
  await page.locator('[data-rail-row="welcome"]').click()
  const screenTitle = page.getByRole('textbox', { name: 'Screen title' })
  await screenTitle.click()
  await screenTitle.fill('Hi {{visitor}}!')

  // preview with a hidden value: answering No skips the conditional block
  await page.getByRole('button', { name: 'Preview' }).click()
  await page.getByLabel('Hidden field visitor').fill('Ada')
  await page.getByRole('button', { name: 'Restart' }).click()
  await expect(page.locator('.fsr-root h1')).toContainText('Hi Ada!', { timeout: 5_000 })
  await page.locator('.fsr-viewport').click() // hand focus back from the preview toolbar
  await page.keyboard.press('Enter')
  await expect(page.locator('.fsr-root h1')).toContainText('Any feedback?', { timeout: 5_000 })
  await page.keyboard.press('n') // No → "Tell us more" is skipped → ending
  await expect(page.locator('.fsr-root h1')).toContainText('Thanks for your time!', {
    timeout: 5_000,
  })
})
