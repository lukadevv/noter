import { expect, test } from '@playwright/test'
import { APP_READY } from './helpers'

test.describe('welcome tour', () => {
  test('is offered on Home, walks every area and is not offered again', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    await page.getByRole('button', { name: 'Show me' }).click()

    const tour = page.getByTestId('tour')
    await expect(tour).toContainText('Welcome to Noter')
    const next = page.getByTestId('tour-next')
    // Stops that navigate take the user there.
    for (let i = 0; i < 5; i++) await next.click()
    await expect(page).toHaveURL(/#\/timers/)
    await expect(tour).toContainText('Alarms, Pomodoro and a stopwatch')
    while (await next.isVisible()) {
      const label = await next.textContent()
      await next.click()
      if (label?.includes('Start using Noter')) break
    }
    await expect(tour).toBeHidden()
    await expect(page.getByRole('button', { name: 'Show me' })).toHaveCount(0)

    await page.reload()
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('home')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Show me' })).toHaveCount(0)
  })

  test('can be skipped with Escape and replayed from Settings', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector(APP_READY)
    await page.getByRole('button', { name: 'Show me' }).click()
    await expect(page.getByTestId('tour')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('tour')).toBeHidden()

    await page.goto('/#/settings/general')
    await page.getByTestId('replay-tour').click()
    await expect(page.getByTestId('tour')).toContainText('Welcome to Noter')
  })
})
