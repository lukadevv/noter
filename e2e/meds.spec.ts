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

    // A mis-tap can be undone.
    await page.getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('med-status')).toContainText('first dose')
  })

  test('shows the next dose coming up and then due on Home', async ({ page }) => {
    await addMed(page, 'Antibiotic', '1 tablet')
    await page.getByTestId('take-dose').click()

    // Eleven and a half hours later: inside the one-hour heads-up.
    await page.clock.fastForward('11:30:00')
    await page.getByTestId('nav-home').click()
    await expect(page.getByTestId('home')).toContainText('Antibiotic · 1 tablet: next dose in 30 min')

    await page.clock.fastForward('00:31:00')
    await expect(page.getByTestId('home')).toContainText('Time for Antibiotic')
    // Taken straight from the alert.
    await page.getByTestId('home').getByRole('button', { name: 'Taken' }).click()
    await expect(page.getByTestId('home')).not.toContainText('Time for Antibiotic')
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
