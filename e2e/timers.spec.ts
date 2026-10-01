import { expect, test, type Page } from '@playwright/test'
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
    // Deleting asks first.
    await page.getByTestId('confirm-ok').click()
    await expect(page.getByTestId('timer-preset')).toHaveCount(7)
  })

  test('runs a pomodoro: focus, then a break, and counts the focus time', async ({ page }) => {
    await page.getByTestId('timer-tabs').getByRole('tab', { name: 'Pomodoro' }).click()
    await expect(page).toHaveURL(/#\/timers\/pomodoro$/)
    await expect(page.getByTestId('pomodoro-clock')).toHaveText('25:00')

    await page.getByTestId('pomodoro-toggle').click()
    await page.clock.fastForward('25:05')
    await expect(page.getByTestId('ringing')).toContainText('Focus')
    await page.getByTestId('ringing').getByRole('button', { name: 'Take a short break' }).click()

    // The break is lined up, ready to start, and the focus session was counted.
    await expect(page.getByTestId('pomodoro-clock')).toHaveText('5:00')
    await expect(page.getByTestId('pomodoro')).toContainText('Short break')
    await expect(page.getByText('25 min').first()).toBeVisible()
  })

  // Real time keeps passing on an installed clock, which makes exact readings flaky.
  const freeze = (page: Page) => page.clock.pauseAt(new Date(Date.now() + 60_000))

  test('keeps stopwatch laps', async ({ page }) => {
    await page.goto('/#/timers/stopwatch')
    await freeze(page)
    await page.getByTestId('stopwatch-toggle').click()
    await page.clock.fastForward('00:10')
    await page.getByTestId('stopwatch-lap').click()
    await page.clock.fastForward('00:05')
    await page.getByTestId('stopwatch-lap').click()
    await expect(page.getByTestId('stopwatch-laps').locator('li')).toHaveCount(2)
    await page.getByTestId('stopwatch-toggle').click()
    await expect(page.getByTestId('stopwatch-time')).toHaveText('00:15')
  })

  test('deletes a lap pressed by accident', async ({ page }) => {
    await page.goto('/#/timers/stopwatch')
    await freeze(page)
    await page.getByTestId('stopwatch-toggle').click()
    await page.clock.fastForward('00:10')
    await page.getByTestId('stopwatch-lap').click()
    await page.getByTestId('stopwatch-lap').click()
    const rows = page.getByTestId('stopwatch-laps').locator('li')
    await expect(rows).toHaveCount(2)
    await rows.first().hover()
    await rows.first().getByTestId('stopwatch-lap-delete').click()
    await expect(rows).toHaveCount(1)
  })

  test('keeps the time display the same width while it runs', async ({ page }) => {
    await page.goto('/#/timers/stopwatch')
    await freeze(page)
    await page.getByTestId('stopwatch-toggle').click()
    const display = page.getByTestId('stopwatch').locator('.display')
    const first = (await display.boundingBox())!.width
    for (const step of [110, 180, 3780]) {
      await page.clock.fastForward(step)
      expect((await display.boundingBox())!.width).toBeCloseTo(first, 0)
    }
  })

  test('lets you hear a sound before choosing it', async ({ page }) => {
    await page.getByTestId('new-preset').click()
    const picker = page.getByTestId('preset-dialog').getByTestId('sound-picker')
    await picker.getByRole('button', { name: 'Play Bell' }).click()
    await picker.locator('[data-sound="bell"]').click()
    await expect(picker.locator('[data-sound="bell"]')).toHaveAttribute('aria-checked', 'true')
  })
})
