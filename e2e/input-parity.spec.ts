import { expect, test } from '@playwright/test'
import { createFolder, createNoteWith, insertBlock, openApp } from './helpers'

/**
 * Every action has to be reachable with a mouse, a keyboard and a finger.
 *
 * The failure mode this guards against is subtle: a control hidden behind
 * `:hover`, or an input that only submits on Enter, works perfectly on the
 * developer's laptop and is simply absent on a phone.
 */
test.describe('input parity', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('inserts a checklist from the / menu with the keyboard alone', async ({ page }) => {
    await createNoteWith(page, 'Sprint')
    await page.keyboard.press('Enter')
    await insertBlock(page, 'checklist')
    await page.keyboard.type('design the schema')

    await page.keyboard.press('Enter')
    await page.keyboard.type('write the tests')
    await page.getByTestId('note-title').click()
    await expect(page.locator('.cm-task-checkbox')).toHaveCount(2)
  })

  test('ticks a task with a click', async ({ page }) => {
    await createNoteWith(page, 'Tasks\n- [ ] something')
    await page.getByTestId('note-title').click()
    await page.locator('.cm-task-checkbox').first().click()
    await expect(page.locator('.cm-task-checkbox').first()).toBeChecked()
  })

  test('adds a board card with the button', async ({ page }) => {
    await createNoteWith(page, 'Planning')
    await page.keyboard.press('Enter')
    await insertBlock(page, 'board')
    await expect(page.getByTestId('board-block')).toBeVisible()
    await expect(page.getByTestId('board-column')).toHaveCount(3)

    await page.getByTestId('board-column').first().getByPlaceholder('Add a card').fill('first card')
    await page.getByTestId('board-column').first().getByLabel('Add', { exact: true }).click()
    await expect(page.getByTestId('board-card')).toHaveCount(1)
    // The card is plain markdown inside the note, so it shows in the list preview.
    await expect(page.getByTestId('note-item').first()).toContainText('first card')
  })

  test('moves a board card between columns from a menu', async ({ page }) => {
    await createNoteWith(page, 'Planning')
    await page.keyboard.press('Enter')
    await insertBlock(page, 'board')
    await expect(page.getByTestId('board-column')).toHaveCount(3)

    await page.getByTestId('board-column').nth(0).getByPlaceholder('Add a card').fill('a card')
    await page.getByTestId('board-column').nth(0).getByLabel('Add', { exact: true }).click()
    await expect(page.getByTestId('board-column').nth(0).getByTestId('board-card')).toHaveCount(1)

    // Drag and drop is not available to a keyboard or a finger; the menu is.
    await page.getByTestId('board-card').first().hover()
    await page.getByLabel('Card actions').first().click()
    await page.getByTestId('menu-item').filter({ hasText: 'Move to Doing' }).click()

    await expect(page.getByTestId('board-column').nth(0).getByTestId('board-card')).toHaveCount(0)
    await expect(page.getByTestId('board-column').nth(1).getByTestId('board-card')).toHaveCount(1)
  })

  test('shows a board as markdown and back', async ({ page }) => {
    await createNoteWith(page, 'Source view')
    await page.keyboard.press('Enter')
    await insertBlock(page, 'board')
    await page.getByTestId('board-block').hover()
    await page.getByRole('button', { name: 'Edit as markdown' }).click()
    await expect(page.getByTestId('board-block')).toHaveCount(0)
    await expect(page.locator('.cm-content')).toContainText('```board')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('board-block')).toBeVisible()
  })

  test('reorders folders from the menu as well as by dragging', async ({ page }) => {
    await createFolder(page, 'Alpha')
    await createFolder(page, 'Beta')

    const rows = page.getByRole('tree').getByTestId('folder-row')
    await rows.nth(1).hover()
    await rows.nth(1).getByLabel('Folder actions').click()
    await page.getByTestId('menu-item').filter({ hasText: 'Move up' }).click()

    // Rows carry a note count after the name, so compare the names only.
    await expect
      .poll(async () =>
        rows.evaluateAll((nodes) => nodes.map((node) => node.querySelector('.name')?.textContent ?? '')),
      )
      .toEqual(['Beta', 'Alpha'])
  })

  test('opens a note menu from a button, not only by right-clicking', async ({ page }) => {
    await createNoteWith(page, 'Reachable note')

    const item = page.getByTestId('note-item').first()
    await item.hover()
    await item.getByLabel('Note actions').click()

    await expect(page.getByTestId('menu-item').filter({ hasText: 'Move to trash' })).toBeVisible()
  })
})

test.describe('input parity on touch', () => {
  // A phone viewport with touch emulation: `@media (hover: hover)` is false, so
  // any control that hides behind hover has to be visible here.
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 780 } })

  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('shows the folder actions button without hovering', async ({ page }) => {
    // The sidebar is off-screen on a phone until you navigate back to it.
    await page.getByLabel('Back to folders').click()
    await page.getByTestId('new-folder').tap()

    const row = page.getByRole('tree').getByTestId('folder-row').first()
    await expect(row).toBeVisible()
    await expect(row.getByLabel('Folder actions')).toBeVisible()
  })

  test('shows the note actions button and selection checkbox', async ({ page }) => {
    await createNoteWith(page, 'A note')
    await page.getByLabel('Back to list').click()

    const item = page.getByTestId('note-item').first()
    await expect(item.getByLabel('Note actions')).toBeVisible()
    await expect(item.getByLabel('Select note')).toBeVisible()
  })

  test('lets a finger start a multi-selection', async ({ page }) => {
    await createNoteWith(page, 'One')
    await page.getByLabel('Back to list').click()
    await createNoteWith(page, 'Two')
    await page.getByLabel('Back to list').click()

    await page.getByTestId('note-item').first().getByLabel('Select note').tap()
    await expect(page.getByTestId('bulk-bar')).toBeVisible()
  })

  test('shows the block handle for the block with the cursor on touch', async ({ page }) => {
    await createNoteWith(page, 'Touch blocks\nSecond block')
    await page.locator('.cm-content').click()
    await expect(page.locator('.cm-block-handle--visible')).toBeVisible()
  })
})
