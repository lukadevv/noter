import { expect, test } from '@playwright/test'
import { createNoteWith, insertBlock, openApp } from './helpers'

/**
 * Narrow-viewport behaviour. This spec runs under the `mobile` project, which
 * uses a phone-sized viewport and touch emulation, so the three-pane layout
 * collapses into a single-pane stack.
 */
test.describe('narrow layout', () => {
  test('walks the pane stack forwards and back', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Mobile note\nWritten on a phone.')

    // Creating a note jumps straight to it; only one pane is on screen.
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.getByTestId('note-list')).toBeHidden()

    await page.getByLabel('Back to list').click()
    await expect(page.getByTestId('note-list')).toBeVisible()
    await expect(page.locator('.cm-content')).toBeHidden()

    await page.getByLabel('Back to folders').click()
    await expect(page.getByTestId('sidebar')).toBeVisible()
    await expect(page.getByTestId('note-list')).toBeHidden()
  })

  test('opens a note from the list', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Tap to open')

    await page.getByLabel('Back to list').click()
    await page.getByTestId('note-item').first().click()
    await expect(page.locator('.cm-content')).toContainText('Tap to open')
  })

  test('never scrolls the page sideways', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Wide content\n' + 'averylongunbrokenword'.repeat(20))

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('inserts a block from the / menu on a phone', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Blocks on mobile')
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.press('Enter')
    await insertBlock(page, 'board')
    await expect(page.getByTestId('board-block')).toBeVisible()
    // A board is wider than a phone; it scrolls inside itself, not the page.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('opens the command palette and search on a phone', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Findable on mobile')

    await page.getByLabel('Back to list').click()
    await page.getByLabel('Back to folders').click()
    await page.getByTestId('open-search').click()

    await expect(page.getByTestId('palette')).toBeVisible()
    await page.getByTestId('palette-input').fill('Findable')
    await page.getByTestId('palette-row').first().click()

    await expect(page.locator('.cm-content')).toContainText('Findable on mobile')
  })
})
