import { expect, test } from '@playwright/test'
import {
  closeSettings,
  createFolder,
  createNote,
  createNoteWith,
  editorText,
  noteByTitle,
  renameFolder,
  folderMenu,
  noteMenu,
  openApp,
  openSettings,
  typeMarkdown,
} from './helpers'

test.describe('notes and folders', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('creates a note and keeps it after a reload', async ({ page }) => {
    await createNoteWith(page, 'Persisted note\nWith a body.')

    await page.reload()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
    await expect(page.getByTestId('note-item').first()).toContainText('Persisted note')

    // Reopening must restore the text itself, not just the list entry.
    await page.getByTestId('note-item').first().click()
    await expect(page.locator('.cm-content')).toContainText('With a body.')
  })

  test('reopens the same folder and note after a reload', async ({ page }) => {
    await createFolder(page, 'Projects')
    await createNoteWith(page, 'Inside the folder')

    await page.reload()
    await expect(page.getByTestId('list-heading')).toHaveText('Projects')
    await expect(page.locator('.cm-content')).toContainText('Inside the folder')
  })

  test('renames a folder inline', async ({ page }) => {
    const row = await createFolder(page, 'Original')
    await renameFolder(page, row, 'Renamed')

    await expect(page.getByRole('tree')).toContainText('Renamed')
    await expect(page.getByRole('tree')).not.toContainText('Original')
  })

  test('abandons a rename on Escape', async ({ page }) => {
    const row = await createFolder(page, 'Keep this')
    await row.getByTestId('folder-label').dblclick()

    const input = page.getByRole('tree').locator('input.rename')
    await input.fill('Discarded')
    await input.press('Escape')

    await expect(page.getByRole('tree')).toContainText('Keep this')
    await expect(page.getByRole('tree')).not.toContainText('Discarded')
  })

  test('counts notes per folder', async ({ page }) => {
    const row = await createFolder(page, 'Counted')
    await createNoteWith(page, 'First note')
    await createNoteWith(page, 'Second note')

    await expect(row).toContainText('2')
  })

  test('moves a note to the trash and back with undo', async ({ page }) => {
    await createNoteWith(page, 'Fragile note')

    await noteMenu(page, 'Move to trash')
    await expect(page.getByTestId('note-item')).toHaveCount(0)

    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('keeps a trashed note readable but not editable', async ({ page }) => {
    await createNoteWith(page, 'Trashed note')
    await noteMenu(page, 'Move to trash')

    await page.getByTestId('view-trash').click()
    await page.getByTestId('note-item').first().click()

    await expect(page.getByText('This note is in the trash')).toBeVisible()
    await expect(page.getByTestId('note-title')).toBeDisabled()
    // The reading view stands in for the editor while a note is trashed.
    await expect(page.locator('.cm-content')).toHaveCount(0)
    await expect(page.locator('.prose')).toContainText('Trashed note')
  })

  test('restores a note from the trash', async ({ page }) => {
    await createNoteWith(page, 'Coming back')
    await noteMenu(page, 'Move to trash')

    await page.getByTestId('view-trash').click()
    await page.getByTestId('note-item').first().click()
    await page.getByRole('button', { name: 'Restore' }).click()

    await page.getByTestId('view-all').click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('archives a note out of the main list', async ({ page }) => {
    await createNoteWith(page, 'Archived note')
    await noteMenu(page, 'Archive')

    await expect(page.getByTestId('note-item')).toHaveCount(0)
    await page.getByTestId('view-archive').click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('pins a note to the top of the list', async ({ page }) => {
    await createNoteWith(page, 'Older note')
    await createNoteWith(page, 'Newer note')

    // Pin the older one; it must jump above the newer one.
    await noteByTitle(page, 'Older note').click()
    await page.getByLabel('Pin note').click()

    await expect(page.getByTestId('note-item').first()).toContainText('Older note')
  })

  test('deletes a folder and sends its notes to the trash', async ({ page }) => {
    const row = await createFolder(page, 'Doomed')
    await createNoteWith(page, 'Note inside')

    await folderMenu(page, row, 'Delete folder')
    await expect(page.getByRole('tree')).not.toContainText('Doomed')

    await page.getByTestId('view-trash').click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('switches a note between views without losing text', async ({ page }) => {
    await createNoteWith(page, 'Shape shifter')
    await typeMarkdown(page, '\n- [ ] a task')
    await expect(page.getByTestId('note-item').first()).toContainText('a task')

    await page.getByTestId('view-tab-checklist').click()
    await expect(page.locator('.task')).toHaveCount(1)

    await page.getByTestId('view-tab-doc').click()
    await expect(page.locator('.cm-content')).toContainText('Shape shifter')
  })

  test('locks a note against edits and unlocks it again', async ({ page }) => {
    await createNoteWith(page, 'Guarded note\nDo not touch.')
    await page.getByTestId('edit-lock').click()
    await expect(page.getByTestId('edit-lock')).toHaveAttribute('aria-pressed', 'true')

    await page.locator('.cm-content').click()
    await page.keyboard.type('XYZ')
    await expect(page.locator('.cm-content')).not.toContainText('XYZ')
    await expect(page.getByText('Locked — tap the padlock to edit')).toBeVisible()

    // The lock is part of the note, so it survives a reload.
    await page.reload()
    await page.getByTestId('note-item').first().click()
    await expect(page.getByTestId('edit-lock')).toHaveAttribute('aria-pressed', 'true')

    await page.keyboard.press('ControlOrMeta+Shift+L')
    await expect(page.getByTestId('edit-lock')).toHaveAttribute('aria-pressed', 'false')
    await page.locator('.cm-content').click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Edited')
    await expect(page.locator('.cm-content')).toContainText('Edited')
  })

  test('keeps undo history per note when switching between notes', async ({ page }) => {
    await createNoteWith(page, 'First note')
    await createNoteWith(page, 'Second note')
    await page.getByTestId('note-item').filter({ hasText: 'First note' }).click()
    await expect(page.locator('.cm-content')).toContainText('First note')
    // Undo right after switching must not bring back the other note's text.
    await page.locator('.cm-content').click()
    await page.keyboard.press('ControlOrMeta+z')
    await expect(page.locator('.cm-content')).not.toContainText('Second note')
  })

  test('creates a note with Ctrl+N', async ({ page }) => {
    await page.keyboard.press('Control+n')
    await expect(page.locator('.cm-content')).toBeVisible()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })

  test('opens settings with Ctrl+comma and closes with Escape', async ({ page }) => {
    await page.keyboard.press('Control+,')
    await expect(page.getByTestId('settings-dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings-dialog')).toBeHidden()
  })

  test('multi-selects notes and archives them in bulk', async ({ page }) => {
    await createNoteWith(page, 'One')
    await createNoteWith(page, 'Two')
    await createNoteWith(page, 'Three')

    const items = page.getByTestId('note-item')
    await items.nth(0).click()
    await items.nth(1).click({ modifiers: ['Control'] })
    await items.nth(2).click({ modifiers: ['Control'] })

    await expect(page.getByTestId('bulk-bar')).toBeVisible()
    await page.getByLabel('Archive selected notes').click()

    await expect(page.getByTestId('note-item')).toHaveCount(0)
    await page.getByTestId('view-archive').click()
    await expect(page.getByTestId('note-item')).toHaveCount(3)
  })

  test('extends a selection with shift-click', async ({ page }) => {
    await createNoteWith(page, 'Alpha')
    await createNoteWith(page, 'Beta')
    await createNoteWith(page, 'Gamma')

    const items = page.getByTestId('note-item')
    await items.nth(0).click()
    await items.nth(2).click({ modifiers: ['Shift'] })

    await expect(page.getByTestId('bulk-bar')).toContainText('3')
  })

  test('applies a theme from settings', async ({ page }) => {
    await openSettings(page)
    await page.getByTestId('settings-section-appearance').click()
    await page.selectOption('#theme-select', 'light')

    // The theme writes tokens onto the root element; that is the real assertion.
    await expect
      .poll(async () =>
        page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()),
      )
      .not.toBe('')

    const background = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    )
    await closeSettings(page)

    await page.reload()
    const afterReload = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    )
    expect(afterReload).toBe(background)
  })

  test('shows an empty state before anything exists', async ({ page }) => {
    await expect(page.getByText('No notes here yet.')).toBeVisible()
    await expect(page.getByText('Select a note, or create one.')).toBeVisible()
  })

  test('derives a title from the first line when none is typed', async ({ page }) => {
    await createNote(page)
    await typeMarkdown(page, '# A derived heading\nbody text')

    await expect(page.getByTestId('note-item').first()).toContainText('A derived heading')
    // The title field stays empty; the heading is only a placeholder.
    await expect(page.getByTestId('note-title')).toHaveValue('')
    expect(await editorText(page)).toContain('A derived heading')
  })
})
