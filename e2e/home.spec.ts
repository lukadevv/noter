import { expect, test } from '@playwright/test'
import { APP_READY, createNoteWith, openApp, openPalette } from './helpers'

test.describe('home dashboard', () => {
  test('counts what was written and shows it on Home', async ({ page }) => {
    await openApp(page)
    await createNoteWith(page, 'Plan\n- [ ] first task\n- [ ] second task')
    await page.getByTestId('nav-home').click()

    const stats = page.getByTestId('home-stats')
    await expect(stats).toContainText('1 new this week')
    // Two open checklist items, none done.
    await expect(stats).toContainText('0 done')
    await expect(stats.getByText('2', { exact: true })).toBeVisible()
    // Today is marked in the heatmap and the streak has started.
    await expect(page.locator('.heatmap rect.cell:not(.level-0)')).not.toHaveCount(0)
    await expect(stats).toContainText('day in a row')
  })

  test('reminds you to write today’s note until it is written', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    const reminder = page.getByText('Today’s note is still blank')
    await expect(reminder).toBeVisible()

    await page.getByRole('button', { name: 'Write it' }).click()
    await expect(page.locator('.cm-content')).toBeVisible()
    await page.locator('.cm-content').click()
    await page.keyboard.type('Went for a walk.')

    await page.getByTestId('nav-home').click()
    await expect(reminder).toBeHidden()
  })

  test('dismisses the reminder for the rest of the day', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    const alert = page.locator('.alert', { hasText: 'Today’s note is still blank' })
    await alert.getByRole('button', { name: 'Dismiss' }).click()
    await expect(alert).toBeHidden()
    await page.reload()
    await expect(page.getByTestId('home')).toBeVisible()
    await expect(alert).toBeHidden()
  })

  test('opens a daily note from the calendar', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    const today = await page.evaluate(() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
    await page.getByTestId('mini-calendar').locator('[aria-current="date"]').click()
    await expect(page.locator('.cm-content')).toBeVisible()
    // Daily notes are titled with the date, in the default YYYY-MM-DD format.
    await expect(page.getByTestId('note-title')).toHaveValue(today)
  })

  test('throws away an empty daily note when moving to the next day', async ({ page }) => {
    await openApp(page)
    await page.keyboard.press('Control+Shift+D')
    await expect(page.getByTestId('note-item')).toHaveCount(1)

    await openPalette(page)
    await page.getByTestId('palette-input').fill('yesterday')
    await page.keyboard.press('Enter')
    // Today's untouched note is gone; only yesterday's (also empty, still open) remains.
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('hides a widget chosen in Settings', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('home-timers')).toBeVisible()

    await page.getByTestId('customize-home').click()
    await page.getByTestId('widget-focus').uncheck()
    await page.getByTestId('nav-home').click()
    await expect(page.getByTestId('home')).toBeVisible()
    await expect(page.getByTestId('home-timers')).toHaveCount(0)
  })
})
