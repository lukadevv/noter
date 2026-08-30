import { expect, test, type Page } from '@playwright/test'
import { createFolder, createNoteWith, openApp } from './helpers'

/** Folder names in tree order, with their nesting depth. */
async function tree(page: Page): Promise<{ name: string; depth: number }[]> {
  return page
    .getByRole('tree')
    .getByTestId('folder-row')
    .evaluateAll((rows) =>
      rows.map((row) => ({
        name: row.querySelector('.name')?.textContent?.trim() ?? '',
        depth: Number(getComputedStyle(row).getPropertyValue('--depth')) || 0,
      })),
    )
}

function names(entries: { name: string }[]): string[] {
  return entries.map((entry) => entry.name)
}

/**
 * Drops one folder onto another.
 *
 * The vertical position decides the outcome: the top and bottom bands of a row
 * reorder, the middle nests. A row is 30px, so the bands are 8px.
 */
async function dropFolder(page: Page, from: number, to: number, where: 'before' | 'into' | 'after') {
  const rows = page.getByRole('tree').getByTestId('folder-row')
  const box = await rows.nth(to).boundingBox()
  if (!box) throw new Error('target row has no box')

  const y = where === 'before' ? 2 : where === 'after' ? box.height - 2 : box.height / 2
  await rows.nth(from).dragTo(rows.nth(to), { targetPosition: { x: box.width / 2, y } })
}

test.describe('folder drag and drop', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
    for (const name of ['Alpha', 'Beta', 'Gamma']) await createFolder(page, name)
    expect(names(await tree(page))).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  test('moves the last folder to the top', async ({ page }) => {
    await dropFolder(page, 2, 0, 'before')
    await expect.poll(async () => names(await tree(page))).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  test('moves a folder to the bottom', async ({ page }) => {
    await dropFolder(page, 0, 2, 'after')
    await expect.poll(async () => names(await tree(page))).toEqual(['Beta', 'Gamma', 'Alpha'])
  })

  test('reorders adjacent folders', async ({ page }) => {
    await dropFolder(page, 1, 0, 'before')
    await expect.poll(async () => names(await tree(page))).toEqual(['Beta', 'Alpha', 'Gamma'])
  })

  test('nests a folder when dropped on the middle of a row', async ({ page }) => {
    await dropFolder(page, 2, 0, 'into')

    await expect
      .poll(async () => await tree(page))
      .toEqual([
        { name: 'Alpha', depth: 0 },
        { name: 'Gamma', depth: 1 },
        { name: 'Beta', depth: 0 },
      ])
  })

  test('survives a reload', async ({ page }) => {
    await dropFolder(page, 2, 0, 'before')
    await expect.poll(async () => names(await tree(page))).toEqual(['Gamma', 'Alpha', 'Beta'])

    await page.reload()
    await expect.poll(async () => names(await tree(page))).toEqual(['Gamma', 'Alpha', 'Beta'])
  })

  test('refuses to move a folder inside its own subtree', async ({ page }) => {
    await dropFolder(page, 1, 0, 'into')
    await expect.poll(async () => (await tree(page))[1]?.depth).toBe(1)

    // Alpha now contains Beta; dropping Alpha into Beta would orphan the branch.
    await dropFolder(page, 0, 1, 'into')

    await expect(
      page.getByTestId('toast').filter({ hasText: 'cannot be moved inside itself' }),
    ).toBeVisible()
    await expect
      .poll(async () => await tree(page))
      .toEqual([
        { name: 'Alpha', depth: 0 },
        { name: 'Beta', depth: 1 },
        { name: 'Gamma', depth: 0 },
      ])
  })

  test('unfiles a nested folder by dropping it below the tree', async ({ page }) => {
    await dropFolder(page, 2, 0, 'into')
    await expect.poll(async () => (await tree(page))[1]?.depth).toBe(1)

    // The empty space under the tree is the "no folder" drop target.
    const rows = page.getByRole('tree').getByTestId('folder-row')
    await rows.nth(1).dragTo(page.getByRole('tree'), { targetPosition: { x: 100, y: 260 } })

    await expect.poll(async () => (await tree(page)).every((entry) => entry.depth === 0)).toBe(true)
    // Unfiling appends, rather than colliding with an existing order value.
    await expect.poll(async () => names(await tree(page))).toEqual(['Alpha', 'Beta', 'Gamma'])
  })

  test('reorders with the keyboard', async ({ page }) => {
    const rows = page.getByRole('tree').getByTestId('folder-row')
    await rows.nth(2).getByTestId('folder-label').click()

    await page.keyboard.press('Alt+ArrowUp')
    await expect.poll(async () => names(await tree(page))).toEqual(['Alpha', 'Gamma', 'Beta'])

    await page.keyboard.press('Alt+ArrowUp')
    await expect.poll(async () => names(await tree(page))).toEqual(['Gamma', 'Alpha', 'Beta'])

    // Already first: nothing to do, and nothing breaks.
    await page.keyboard.press('Alt+ArrowUp')
    await expect.poll(async () => names(await tree(page))).toEqual(['Gamma', 'Alpha', 'Beta'])

    await page.keyboard.press('Alt+ArrowDown')
    await expect.poll(async () => names(await tree(page))).toEqual(['Alpha', 'Gamma', 'Beta'])
  })

  test('moves a note into a folder by dropping it on the row', async ({ page }) => {
    await page.getByTestId('view-all').click()
    await createNoteWith(page, 'Portable note')

    const row = page.getByRole('tree').getByTestId('folder-row').filter({ hasText: 'Beta' })
    await page.getByTestId('note-item').first().dragTo(row)

    await expect(page.getByTestId('toast').filter({ hasText: 'Note moved' })).toBeVisible()
    await row.getByTestId('folder-label').click()
    await expect(page.getByTestId('note-item')).toHaveCount(1)
  })
})
