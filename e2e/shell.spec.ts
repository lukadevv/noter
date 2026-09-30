import { expect, test } from '@playwright/test'
import { APP_READY, createFolder, createNoteWith, openApp } from './helpers'

test.describe('app shell', () => {
  test('opens on Home and moves between sections from the rail', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('home')).toBeVisible()

    await page.getByTestId('nav-notes').click()
    await expect(page).toHaveURL(/#\/notes$/)
    await expect(page.getByTestId('note-list')).toBeVisible()

    await page.getByTestId('nav-home').click()
    await expect(page.getByTestId('home')).toBeVisible()

    // Browser Back returns to the notes, because sections are real addresses.
    await page.goBack()
    await expect(page.getByTestId('note-list')).toBeVisible()
  })

  test('switches sections with Ctrl+number', async ({ page }) => {
    await openApp(page)
    await page.keyboard.press('Control+1')
    await expect(page.getByTestId('home')).toBeVisible()
    await page.keyboard.press('Control+2')
    await expect(page.getByTestId('note-list')).toBeVisible()
  })

  test('opens a recent note from Home', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Shown on home\nBody text.')
    await page.getByTestId('nav-home').click()
    await page.getByRole('button', { name: /Shown on home/ }).click()
    await expect(page.locator('.cm-content')).toContainText('Body text.')
  })

  test('opens the folder menu with a right-click', async ({ page }) => {
    await openApp(page)
    await createFolder(page, 'Projects')
    await page.getByTestId('folder-row').filter({ hasText: 'Projects' }).click({ button: 'right' })
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitem', { name: 'New subfolder' })).toBeVisible()

    // Keyboard: arrows move, Escape closes.
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toBeHidden()
  })

  test('moves a note to a folder from the note submenu', async ({ page }) => {
    await openApp(page)
    await createFolder(page, 'Archive box')
    await page.getByTestId('view-all').click()
    await createNoteWith(page, 'Movable\nText.')
    await page.getByTestId('note-item').filter({ hasText: 'Movable' }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Move to', exact: true }).click()
    await page.getByRole('menuitem', { name: /Archive box/ }).click()

    await page
      .getByTestId('folder-row')
      .filter({ hasText: 'Archive box' })
      .getByTestId('folder-label')
      .click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('filters settings sections by what they contain', async ({ page }) => {
    await openApp(page)
    await page.getByTestId('open-settings').click()
    await page.getByRole('searchbox', { name: 'Search settings' }).fill('animations')
    await expect(page.getByTestId('settings-section-appearance')).toBeVisible()
    await expect(page.getByTestId('settings-section-backup')).toHaveCount(0)

    await page.getByTestId('settings-section-appearance').click()
    await page.getByTestId('motion-setting').getByRole('radio', { name: 'Off' }).click()
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.motion)).toBe('off')
  })

  test('hides and restores the folder sidebar', async ({ page }) => {
    await openApp(page)
    await page.getByRole('button', { name: 'Hide folders' }).click()
    await expect(page.getByTestId('sidebar')).not.toBeInViewport()
    await page.getByRole('button', { name: 'Show folders' }).click()
    await expect(page.getByTestId('sidebar')).toBeInViewport()
  })
})
