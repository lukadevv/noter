import { expect, test, type Page } from '@playwright/test'
import { APP_READY } from './helpers'

async function addMed(page: Page, name: string, dose = '400 mg') {
  await page.getByTestId('add-med').click()
  const dialog = page.getByTestId('med-dialog')
  await dialog.getByLabel('Name').fill(name)
  await dialog.getByLabel('Dose', { exact: true }).fill(dose)
  await dialog.getByRole('radio', { name: '12 h' }).click()
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

test.describe('medication', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install()
    await page.goto('/#/meds')
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('meds')).toBeVisible()
  })

  test('adds a medication and logs a dose', async ({ page }) => {
    await addMed(page, 'Ibuprofen')
    await expect(page.getByTestId('med-card')).toHaveCount(1)
    await expect(page.getByTestId('med-status')).toContainText('first dose')

    await page.getByTestId('take-dose').click()
    await expect(page.getByTestId('med-status')).toContainText('Next in 12 h')
    await expect(page.getByText('Today', { exact: true })).toBeVisible()

    // A mis-tap can be undone, straight from the toast.
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('med-status')).toContainText('first dose')
  })

  test('asks before logging a dose that comes too early', async ({ page }) => {
    await addMed(page, 'Ibuprofen')
    await page.getByTestId('take-dose').click()
    await expect(page.getByTestId('med-status')).toContainText('Next in 12 h')

    // A second tap an hour later is probably a double dose.
    await page.clock.fastForward('01:00:00')
    await page.getByTestId('take-dose').click()
    const dialog = page.getByTestId('confirm-dialog')
    await expect(dialog).toContainText('Another dose of Ibuprofen already?')
    await expect(dialog).toContainText('Already taken: 1 dose in the last 12 h')
    await page.getByTestId('confirm-cancel').click()
    await expect(dialog).toBeHidden()
    await expect(page.locator('.entry')).toHaveCount(1)

    // Confirming logs it anyway.
    await page.getByTestId('take-dose').click()
    await page.getByTestId('confirm-ok').click()
    await expect(page.locator('.entry')).toHaveCount(2)
  })

  test('shows the next dose coming up and then due on Home', async ({ page }) => {
    await addMed(page, 'Antibiotic', '1 tablet')
    await page.getByTestId('take-dose').click()

    // Eleven and a half hours later: inside the one-hour heads-up.
    await page.clock.fastForward('11:30:00')
    await page.getByTestId('nav-home').click()
    const today = page.getByTestId('home-today')
    await expect(today).toContainText('Antibiotic · 1 tablet')
    await expect(today).toContainText('in 30 min')

    await page.clock.fastForward('00:31:00')
    await expect(today).toContainText('Due now')
    // Taken straight from Home's "Today".
    await today.getByRole('button', { name: 'Taken' }).click()
    await expect(today).not.toContainText('Due now')
  })

  test('counts down the stock and warns when it runs low', async ({ page }) => {
    await page.getByTestId('add-med').click()
    const dialog = page.getByTestId('med-dialog')
    await dialog.getByLabel('Name').fill('Vitamin D')
    await dialog.getByText('Count how many are left').click()
    await dialog.getByLabel('In stock').fill('4')
    await dialog.getByRole('button', { name: 'Save' }).click()

    await page.getByTestId('take-dose').click()
    await expect(page.getByTestId('med-card')).toContainText('3 doses left')
  })
})
