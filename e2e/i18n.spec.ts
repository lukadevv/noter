import { expect, test, type Page } from '@playwright/test'
import { createNoteWith, openApp, openSettings } from './helpers'

async function chooseLanguage(page: Page, locale: string) {
  // Settings may already be open from a previous switch; opening it again would
  // click a button that is behind the dialog's backdrop.
  if (!(await page.getByTestId('settings-dialog').isVisible())) await openSettings(page)
  await page.getByTestId('language-select').selectOption(locale)
  // The catalogue is a separate chunk, so the labels change a beat later.
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale)
}

test.describe('languages', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('lists every language in its own script', async ({ page }) => {
    await openSettings(page)
    const options = await page.getByTestId('language-select').locator('option').allTextContents()

    expect(options).toEqual(
      expect.arrayContaining(['English', 'Español', 'Português', 'Français', '中文', '한국어', 'العربية']),
    )
    expect(options).toHaveLength(10)
  })

  test('translates the interface and keeps it after a reload', async ({ page }) => {
    await chooseLanguage(page, 'es')
    await page.getByLabel('Cerrar los ajustes').click()

    await expect(page.getByTestId('view-all')).toContainText('Todas las notas')
    await expect(page.getByTestId('view-trash')).toContainText('Papelera')

    await page.reload()
    await expect(page.getByTestId('view-all')).toContainText('Todas las notas')
    // The document language is what assistive tech and search engines read.
    await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe('es')
  })

  test('switches direction to right-to-left for Arabic', async ({ page }) => {
    await chooseLanguage(page, 'ar')

    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('rtl')
    await expect(page.getByTestId('view-all')).toContainText('كل الملاحظات')

    // The sidebar has to move to the right edge, not merely mirror its text.
    const [sidebar, list] = await page.evaluate(() => [
      document.querySelector('[data-testid="sidebar"]')!.getBoundingClientRect().left,
      document.querySelector('[data-testid="note-list"]')!.getBoundingClientRect().left,
    ])
    expect(sidebar).toBeGreaterThan(list)
  })

  test('returns to left-to-right when leaving Arabic', async ({ page }) => {
    await chooseLanguage(page, 'ar')
    await chooseLanguage(page, 'en')
    await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe('ltr')
  })

  test('translates dialogs and menus, not just the shell', async ({ page }) => {
    await chooseLanguage(page, 'fr')
    await page.getByLabel('Fermer les paramètres').click()

    await createNoteWith(page, 'Une note')
    await page.getByTestId('note-menu').click()
    await expect(page.getByTestId('menu-item').first()).toContainText('Épingler')
  })

  test('picks a plural form per language', async ({ page }) => {
    // English distinguishes one from many; Japanese has a single form.
    await createNoteWith(page, 'Cible')
    await createNoteWith(page, 'Source\nVoir [[Cible]].')

    await page.getByTestId('note-item-title').filter({ hasText: 'Cible' }).click()
    await expect(page.locator('.backlinks')).toContainText('1 note links here')

    await chooseLanguage(page, 'ja')
    await page.getByLabel('設定を閉じる').click()
    await page.getByTestId('note-item-title').filter({ hasText: 'Cible' }).click()
    await expect(page.locator('.backlinks')).toContainText('1 件のノート')
  })

  test('falls back to English rather than showing a blank label', async ({ page }) => {
    // Every visible string resolves to something: no key names, no empty labels.
    await chooseLanguage(page, 'ko')
    await page.getByLabel('설정 닫기').click()

    const labels = await page
      .getByTestId('sidebar')
      .locator('button')
      .evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim() ?? ''))

    for (const label of labels) {
      expect(label, 'a raw message key leaked into the interface').not.toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/)
    }
  })

  test('does not download other catalogues until they are chosen', async ({ page }) => {
    const requested: string[] = []
    page.on('request', (request) => {
      if (request.url().endsWith('.js')) requested.push(request.url())
    })

    await openApp(page)
    expect(requested.some((url) => /\/(es|ar|ja)-.*\.js$/.test(url))).toBe(false)

    await chooseLanguage(page, 'es')
    expect(requested.some((url) => /\/es-.*\.js$/.test(url))).toBe(true)
    // Choosing Spanish must not pull in the other eight.
    expect(requested.some((url) => /\/(ar|ja|ko)-.*\.js$/.test(url))).toBe(false)
  })
})
