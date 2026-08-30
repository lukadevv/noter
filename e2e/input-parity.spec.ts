import { expect, test } from '@playwright/test'
import { createFolder, createNoteWith, openApp } from './helpers'

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

  test('adds a task with the button, not only with Enter', async ({ page }) => {
    await createNoteWith(page, 'Sprint')
    await page.getByTestId('view-tab-checklist').click()

    const field = page.getByPlaceholder('Add a task')
    const add = page.getByRole('button', { name: 'Add', exact: true })

    // Nothing to add yet, so the button says so rather than doing nothing.
    await expect(add).toBeDisabled()

    await field.fill('design the schema')
    await expect(add).toBeEnabled()
    await add.click()

    await expect(page.locator('.task')).toHaveCount(1)
    await expect(field).toHaveValue('')
  })

  test('still adds a task with Enter', async ({ page }) => {
    await createNoteWith(page, 'Sprint')
    await page.getByTestId('view-tab-checklist').click()

    await page.getByPlaceholder('Add a task').fill('write the tests')
    await page.getByPlaceholder('Add a task').press('Enter')

    await expect(page.locator('.task')).toHaveCount(1)
  })

  test('adds a board card with the button', async ({ page }) => {
    await createNoteWith(page, '## To do')
    await page.getByTestId('view-tab-board').click()

    await page.getByPlaceholder('Add a card').fill('first card')
    await page.getByLabel('Add', { exact: true }).click()

    await expect(page.getByTestId('board-card')).toHaveCount(1)
  })

  test('moves a board card between columns from a menu', async ({ page }) => {
    await createNoteWith(page, 'Planning')
    await page.getByTestId('view-tab-board').click()

    // Built through the board's own controls rather than by typing markdown:
    // the editor continues lists on Enter, which turns a typed heading into a
    // card and quietly tests something else.
    // A note with no headings starts with no columns at all, so both are added
    // here rather than one.
    await page.getByRole('button', { name: 'Add column' }).click()
    await expect(page.getByTestId('board-column')).toHaveCount(1)
    await page.getByRole('button', { name: 'Add column' }).click()
    await expect(page.getByTestId('board-column')).toHaveCount(2)
    await page.getByTestId('board-column').locator('.title').nth(1).fill('Doing')
    await page.getByTestId('board-column').locator('.title').nth(1).blur()

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

  test('shows the task delete button without hovering', async ({ page }) => {
    await createNoteWith(page, 'Tasks\n- [ ] something')
    await page.getByTestId('view-tab-checklist').click()

    await expect(page.locator('.task').first().getByLabel('Delete task')).toBeVisible()
  })
})
