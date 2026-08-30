import { expect, test, type Page } from '@playwright/test'
import { createNote, createNoteWith, noteMenu, openApp, TINY_PNG, typeMarkdown } from './helpers'

/** Attaches an image through whichever file picker the app just opened. */
async function attachImage(page: Page, open: () => Promise<void>) {
  const chooser = page.waitForEvent('filechooser')
  await open()
  await (await chooser).setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: TINY_PNG })
}

test.describe('images', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('adds an image from the file picker and renders it inline', async ({ page }) => {
    await createNoteWith(page, 'Note with a picture')

    await attachImage(page, () => noteMenu(page, 'Add images'))

    // The editor renders the reference as a real <img> backed by a blob URL.
    const inline = page.locator('.cm-inline-image img')
    await expect(inline).toHaveCount(1)
    await expect(inline).toHaveAttribute('src', /^blob:/)
  })

  test('stores the image so it survives a reload', async ({ page }) => {
    await createNoteWith(page, 'Durable picture')
    await attachImage(page, () => noteMenu(page, 'Add images'))
    await expect(page.locator('.cm-inline-image img')).toHaveCount(1)

    await page.reload()
    await page.getByTestId('note-item').first().click()
    await expect(page.locator('.cm-inline-image img')).toHaveAttribute('src', /^blob:/)
  })

  test('deduplicates the same image added twice', async ({ page }) => {
    await createNoteWith(page, 'Twice over')
    await attachImage(page, () => noteMenu(page, 'Add images'))
    await expect(page.locator('.cm-inline-image')).toHaveCount(1)
    await attachImage(page, () => noteMenu(page, 'Add images'))
    await expect(page.locator('.cm-inline-image')).toHaveCount(2)

    // Two references, but the identical bytes are stored once.
    const assetCount = await page.evaluate(async () => {
      const open = indexedDB.open('noter')
      const database = await new Promise<IDBDatabase>((resolve) => {
        open.onsuccess = () => resolve(open.result)
      })
      const count = await new Promise<number>((resolve) => {
        const request = database.transaction('assets', 'readonly').objectStore('assets').count()
        request.onsuccess = () => resolve(request.result)
      })
      database.close()
      return count
    })
    expect(assetCount).toBe(1)
  })

  test('shows images in the gallery view and opens the lightbox', async ({ page }) => {
    await createNoteWith(page, 'Gallery note')
    await page.getByTestId('view-tab-gallery').click()

    await attachImage(page, async () => {
      await page.getByRole('button', { name: 'Add images' }).first().click()
    })

    await expect(page.getByTestId('gallery-tile')).toHaveCount(1)
    await page.getByTestId('gallery-tile').first().click()
    await expect(page.getByTestId('lightbox')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('lightbox')).toBeHidden()
  })

  test('renders a stored image in the reading view', async ({ page }) => {
    await createNoteWith(page, 'Readable picture')
    await attachImage(page, () => noteMenu(page, 'Add images'))
    await expect(page.locator('.cm-inline-image img')).toHaveCount(1)

    await page.getByLabel('Reading view').click()
    await expect(page.locator('.prose img.asset')).toHaveAttribute('src', /^blob:/)
  })

  test('flags an image linked from a remote URL as external', async ({ page }) => {
    await createNote(page)
    // Rendered from markdown rather than pasted, so the test does not depend on
    // the network; the point is that remote images are visibly marked.
    await typeMarkdown(page, 'Remote picture\n\n![](https://example.invalid/a.png)')
    await page.getByLabel('Reading view').click()

    const image = page.locator('.prose img[data-external]')
    await expect(image).toHaveCount(1)
    await expect(image).toHaveAttribute('referrerpolicy', 'no-referrer')
  })

  test('cleans up images no note references any more', async ({ page }) => {
    await createNoteWith(page, 'Temporary picture')
    await attachImage(page, () => noteMenu(page, 'Add images'))
    await expect(page.locator('.cm-inline-image')).toHaveCount(1)

    await noteMenu(page, 'Move to trash')
    await page.getByTestId('view-trash').click()
    await page.getByRole('button', { name: 'Empty trash' }).click()

    await page.getByTestId('open-settings').click()
    await page.getByRole('button', { name: 'Clean up unused images' }).click()
    // Several toasts can be stacked by this point, so match the one we mean.
    await expect(page.getByTestId('toast').filter({ hasText: 'unused image' })).toBeVisible()
  })
})
