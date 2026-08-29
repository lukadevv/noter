import { expect, test } from '@playwright/test'
import { createNoteWith, noteByTitle, openApp, openPalette, typeMarkdown } from './helpers'

test.describe('search, tags and links', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('finds a note by its text from the palette', async ({ page }) => {
    await createNoteWith(page, 'Parser design\nNotes about the lexer.')
    await createNoteWith(page, 'Grocery list\nBread and coffee.')

    await openPalette(page)
    await page.getByTestId('palette-input').fill('lexer')

    const rows = page.getByTestId('palette-row')
    await expect(rows.first()).toContainText('Parser design')

    await rows.first().click()
    await expect(page.getByTestId('palette')).toBeHidden()
    await expect(page.locator('.cm-content')).toContainText('lexer')
  })

  test('lists commands under the > prefix', async ({ page }) => {
    await openPalette(page)
    await page.getByTestId('palette-input').fill('>new folder')

    await expect(page.getByTestId('palette-row').first()).toContainText('New folder')
    await page.getByTestId('palette-row').first().click()
    await expect(page.getByRole('tree').getByTestId('folder-row')).toHaveCount(1)
  })

  test('closes the palette on Escape', async ({ page }) => {
    await openPalette(page)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('palette')).toBeHidden()
  })

  test('collects tags out of the note text', async ({ page }) => {
    await createNoteWith(page, 'Tagged note\nWork on the #parser and the #ui today.')

    const tags = page.getByTestId('tag-chip')
    await expect(tags).toHaveCount(2)
    await expect(tags.filter({ hasText: 'parser' })).toBeVisible()

    await tags.filter({ hasText: 'parser' }).click()
    await expect(page.getByTestId('list-heading')).toHaveText('#parser')
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('does not treat a heading as a tag', async ({ page }) => {
    await createNoteWith(page, '# Just a heading\nno tags here')
    await expect(page.getByTestId('tag-chip')).toHaveCount(0)
  })

  test('runs a structured query and saves it as a smart folder', async ({ page }) => {
    await createNoteWith(page, 'Bug report\nSomething broke. #bug')
    await createNoteWith(page, 'Chore\nTidy up. #chore')

    await openPalette(page)
    await page.getByTestId('palette-input').fill('tag:bug')

    // The last row is always the "search for everything matching" entry.
    const rows = page.getByTestId('palette-row')
    await rows.last().click()

    await expect(page.getByTestId('list-heading')).toHaveText('Search: tag:bug')
    await expect(page.getByTestId('note-item')).toHaveCount(1)

    page.once('dialog', (dialog) => dialog.accept('Open bugs'))
    await page.getByTestId('save-search').click()

    await expect(page.getByTestId('smart-folder')).toContainText('Open bugs')

    // A saved search must still work after a reload.
    await page.reload()
    await page.getByTestId('smart-folder').click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('follows a wiki link and creates the missing note', async ({ page }) => {
    await createNoteWith(page, 'Origin note\nSee [[Target note]] for details.')

    await page.getByLabel('Reading view').click()
    await page.locator('.prose a.wikilink').click()

    await expect(page.getByTestId('note-title')).toHaveValue('Target note')
    await expect(page.getByTestId('note-item')).toHaveCount(2)
  })

  test('shows backlinks on the linked note', async ({ page }) => {
    await createNoteWith(page, 'Target note\nThe destination.')
    await createNoteWith(page, 'Source note\nLinks to [[Target note]].')

    await noteByTitle(page, 'Target note').click()
    const backlinks = page.locator('.backlinks')
    await expect(backlinks).toContainText('1 note links here')

    await backlinks.locator('.head').click()
    await expect(backlinks.locator('.entry')).toContainText('Source note')
  })

  test('repoints wiki links when a note is renamed', async ({ page }) => {
    await createNoteWith(page, 'Old name\nThe destination.')
    await createNoteWith(page, 'Referring note\nPoints at [[Old name]].')

    await noteByTitle(page, 'Old name').click()
    const title = page.getByTestId('note-title')
    await title.fill('New name')
    await title.blur()

    await expect(page.getByTestId('toast').filter({ hasText: 'Updated links' })).toBeVisible()

    await noteByTitle(page, 'Referring note').click()
    await expect(page.locator('.cm-content')).toContainText('[[New name]]')
  })

  test('completes a tag while typing', async ({ page }) => {
    await createNoteWith(page, 'First note\nTagged with #photography')
    await createNoteWith(page, 'Second note')

    await typeMarkdown(page, '\nnow #pho')

    const options = page.locator('.cm-tooltip-autocomplete li')
    await expect(options.filter({ hasText: 'photography' })).toHaveCount(1)
    // The tag currently being typed must not be offered back as a completion.
    await expect(options.filter({ hasText: /^pho$/ })).toHaveCount(0)
  })

  test('completes a wiki link target while typing', async ({ page }) => {
    await createNoteWith(page, 'Reference material\nSomething to link to.')
    await createNoteWith(page, 'Linking note')

    await typeMarkdown(page, '\nsee [[Refer')
    await expect(page.locator('.cm-tooltip-autocomplete li').first()).toContainText('Reference material')
  })
})
