import { expect, test, type Page } from '@playwright/test'
import { APP_READY } from './helpers'

test.describe('habits', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/habits')
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('habits')).toBeVisible()
  })

  async function addHabit(page: Page, name: string, times = 1) {
    await page.getByTestId('add-habit').click()
    const dialog = page.getByTestId('habit-dialog')
    await dialog.getByTestId('habit-name').fill(name)
    for (let i = 1; i < times; i++)
      await dialog.getByRole('group', { name: 'Times a day' }).getByLabel('+').click()
    await dialog.getByTestId('habit-save').click()
    await expect(dialog).toBeHidden()
  }

  test('adds a habit and ticks it off', async ({ page }) => {
    await addHabit(page, 'Read')
    const card = page.getByTestId('habit-card')
    await expect(card).toHaveCount(1)
    await expect(page.getByText('1 habit to go')).toBeVisible()

    await card.getByTestId('habit-check').click()
    await expect(card.getByTestId('habit-check')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText('All done for today')).toBeVisible()
  })

  test('counts up to a daily target', async ({ page }) => {
    await addHabit(page, 'Water', 3)
    const check = page.getByTestId('habit-check')
    await check.click()
    await check.click()
    await expect(page.getByTestId('habit-card')).toContainText('2/3')
    await check.click()
    await expect(check).toHaveAttribute('aria-pressed', 'true')
  })

  test('shows on Home and can be ticked there', async ({ page }) => {
    await addHabit(page, 'Stretch')
    await page.getByTestId('nav-home').click()
    const today = page.getByTestId('home-today')
    await expect(today).toContainText('Stretch')
    await today.getByTestId('home-habit-check').click()
    await expect(today.getByTestId('home-habit-check')).toHaveAttribute('aria-pressed', 'true')
  })

  test('asks before deleting', async ({ page }) => {
    await addHabit(page, 'Gym')
    await page.getByTestId('habit-card').click({ button: 'right', position: { x: 10, y: 10 } })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByTestId('confirm-cancel').click()
    await expect(page.getByTestId('habit-card')).toHaveCount(1)
    await page.getByTestId('habit-card').click({ button: 'right', position: { x: 10, y: 10 } })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('habit-card')).toHaveCount(0)
  })
})
