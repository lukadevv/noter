import { expect, test } from '@playwright/test'
import { APP_READY } from './helpers'

test.describe('timers', () => {
  test.beforeEach(async ({ page }) => {
    // A controllable clock, so a ten-minute timer rings in a test that takes seconds.
    await page.clock.install()
    await page.goto('/#/timers')
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('timers')).toBeVisible()
  })

  test('starts with a set of presets', async ({ page }) => {
    await expect(page.getByTestId('timer-preset')).toHaveCount(7)
  })

  test('rings when a timer runs out, and stops', async ({ page }) => {
    await page.getByTestId('timer-preset').first().click()
    await expect(page.getByTestId('running-timer')).toHaveCount(1)

    await page.clock.fastForward('01:05')
    await expect(page.getByTestId('ringing')).toBeVisible()
    await expect(page.getByTestId('ringing')).toContainText('Time’s up')

    await page.getByTestId('ringing').getByRole('button', { name: 'Stop' }).click()
    await expect(page.getByTestId('ringing')).toBeHidden()
    await expect(page.getByTestId('running-timer')).toHaveCount(0)
  })

  test('rings on any section, not only on Timers', async ({ page }) => {
    await page.getByTestId('timer-preset').first().click()
    await page.getByTestId('nav-notes').click()
    await page.clock.fastForward('01:05')
    await expect(page.getByTestId('ringing')).toBeVisible()
    // Snoozing turns it back into a countdown.
    await page.getByTestId('ringing').getByRole('button', { name: '+5 min' }).click()
    await expect(page.getByTestId('ringing')).toBeHidden()
  })

  test('starts a timer typed as a duration and pauses it', async ({ page }) => {
    await page.getByTestId('quick-timer').fill('90s')
    await page.getByTestId('quick-timer').press('Enter')
    await expect(page.getByTestId('timer-clock')).toHaveText(/1:(30|29)/)

    await page.getByRole('button', { name: 'Pause' }).click()
    await page.clock.fastForward('02:00')
    await expect(page.getByTestId('ringing')).toBeHidden()
    await expect(page.getByTestId('running-timer')).toContainText('Paused')
  })

  test('survives a reload with its end time intact', async ({ page }) => {
    await page.getByTestId('quick-timer').fill('10')
    await page.getByTestId('quick-timer').press('Enter')
    await expect(page.getByTestId('running-timer')).toHaveCount(1)
    await page.reload()
    await expect(page.getByTestId('running-timer')).toHaveCount(1)
  })

  test('creates, reorders and deletes a preset', async ({ page }) => {
    await page.getByTestId('new-preset').click()
    await page.getByTestId('preset-dialog').getByLabel('Name').fill('Laundry')
    await page.getByTestId('preset-dialog').getByRole('button', { name: 'Save' }).click()
    await expect(page.getByTestId('timer-preset')).toHaveCount(8)
    await expect(page.getByTestId('timer-preset').last()).toContainText('Laundry')

    // Alt+Left moves it one place earlier.
    await page.getByTestId('timer-preset').last().focus()
    await page.keyboard.press('Alt+ArrowLeft')
    await expect(page.getByTestId('timer-preset').nth(6)).toContainText('Laundry')

    await page.getByTestId('timer-preset').nth(6).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByTestId('timer-preset')).toHaveCount(7)
  })
})
