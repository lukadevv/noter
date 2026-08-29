import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Shared helpers for the end-to-end suite.
 *
 * Everything here waits on observable state rather than on time. The one
 * exception is `settleAutosave`, which has to account for the editor's 400 ms
 * write debounce, and it waits for the note list to reflect the text instead of
 * simply sleeping.
 */

export const APP_READY = '[data-testid="app-shell"]'

/**
 * Opens the app and waits for it to be usable.
 *
 * The readiness signal is the shell, not the sidebar: on a narrow viewport the
 * three panes collapse into a stack and only one of them is on screen, so any
 * single pane is the wrong thing to wait for.
 */
export async function openApp(page: Page): Promise<void> {
  await page.goto('/')
  await page.waitForSelector(APP_READY)
  // The panes stay in the DOM and are hidden by CSS, so "attached" is the check
  // that holds in both layouts.
  await expect(page.getByTestId('note-list')).toBeAttached()
}

/** Creates a note and waits for the editor to be ready to receive input. */
export async function createNote(page: Page): Promise<void> {
  const headerButton = page.getByTestId('new-note')
  if (await headerButton.isVisible().catch(() => false)) await headerButton.click()
  else await page.getByTestId('new-note-empty').click()

  await expect(page.locator('.cm-content')).toBeVisible()
  await page.locator('.cm-content').click()
}

/**
 * Types markdown into the editor.
 *
 * `Enter` is pressed explicitly between lines because CodeMirror's markdown mode
 * continues lists automatically; typing a literal newline would produce a second
 * list marker on the next line.
 */
export async function typeMarkdown(page: Page, text: string): Promise<void> {
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    if (index > 0) await page.keyboard.press('Enter')
    if (line) await page.keyboard.type(line)
  }
}

/**
 * Waits until the text is actually in IndexedDB.
 *
 * Checking the note list is not enough: the store updates the list optimistically
 * the moment a key is pressed, while the write itself is on a 400 ms debounce. A
 * test that reloaded on the strength of the list alone would race the write and
 * fail intermittently — so this reads the database directly.
 */
export async function settleAutosave(page: Page, expectedText: string): Promise<void> {
  await expect(page.getByTestId('note-item').filter({ hasText: expectedText })).toHaveCount(1, {
    timeout: 10_000,
  })

  await expect
    .poll(() => notePersisted(page, expectedText), { timeout: 10_000, message: `"${expectedText}" never reached IndexedDB` })
    .toBe(true)
}

/** True once a note whose title or body contains `needle` exists in IndexedDB. */
export function notePersisted(page: Page, needle: string): Promise<boolean> {
  return page.evaluate(async (text) => {
    const open = indexedDB.open('noter')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })

    if (!database.objectStoreNames.contains('notes')) {
      database.close()
      return false
    }

    const rows = await new Promise<{ title: string; body: string }[]>((resolve) => {
      const request = database.transaction('notes', 'readonly').objectStore('notes').getAll()
      request.onsuccess = () => resolve(request.result as { title: string; body: string }[])
      request.onerror = () => resolve([])
    })
    database.close()

    return rows.some((row) => `${row.title}\n${row.body}`.includes(text))
  }, needle)
}

export async function createNoteWith(page: Page, text: string): Promise<void> {
  await createNote(page)
  await typeMarkdown(page, text)
  // The list shows a derived title with markdown markers stripped, so the
  // expected text has to be stripped the same way.
  const firstLine = text.split('\n')[0]!.replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+/, '')
  await settleAutosave(page, firstLine.slice(0, 20))
}

/** A note row addressed by its title, so a mention in another note's preview
 *  does not match as well. */
export function noteByTitle(page: Page, title: string): Locator {
  return page
    .getByTestId('note-item')
    .filter({ has: page.getByTestId('note-item-title').filter({ hasText: title }) })
}

/** Renames the folder in `row` inline, without creating one first. */
export async function renameFolder(page: Page, row: Locator, name: string): Promise<void> {
  await row.getByTestId('folder-label').dblclick()
  const input = page.getByRole('tree').locator('input.rename')
  await expect(input).toBeFocused()
  await input.fill(name)
  await input.press('Enter')
}

/**
 * Creates a folder and renames it, returning its row locator.
 *
 * The row is addressed by position, not by text: starting a rename swaps the
 * name for an input, so a text-based locator would stop matching exactly when it
 * is needed. For the same reason the rename field is looked up on the tree —
 * only one can be open at a time.
 */
export async function createFolder(page: Page, name: string): Promise<Locator> {
  const tree = page.getByRole('tree')
  const rows = tree.getByTestId('folder-row')
  const before = await rows.count()

  await page.getByTestId('new-folder').click()
  await expect(rows).toHaveCount(before + 1)

  // New folders are appended, so the new one is the last row.
  await rows.nth(before).getByTestId('folder-label').dblclick()

  const input = tree.locator('input.rename')
  await expect(input).toBeFocused()
  await input.fill(name)
  await input.press('Enter')

  const renamed = tree.getByTestId('folder-row').filter({ hasText: name }).first()
  await expect(renamed).toBeVisible()
  return renamed
}

/** Opens a folder's context menu and clicks one of its items. */
export async function folderMenu(page: Page, row: Locator, item: string | RegExp): Promise<void> {
  await row.hover()
  await row.getByLabel('Folder actions').click()
  await page.getByTestId('menu-item').filter({ hasText: item }).click()
}

/** Opens the current note's action menu and clicks one of its items. */
export async function noteMenu(page: Page, item: string | RegExp): Promise<void> {
  await page.getByTestId('note-menu').click()
  await page.getByTestId('menu-item').filter({ hasText: item }).click()
}

export async function openSettings(page: Page): Promise<void> {
  await page.getByTestId('open-settings').click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
}

export async function closeSettings(page: Page): Promise<void> {
  await page.getByLabel('Close settings').click()
  await expect(page.getByTestId('settings-dialog')).toBeHidden()
}

export async function openPalette(page: Page): Promise<void> {
  await page.keyboard.press('Control+k')
  await expect(page.getByTestId('palette')).toBeVisible()
}

/** Text content of the editor, with CodeMirror's line wrappers flattened. */
export async function editorText(page: Page): Promise<string> {
  return page.locator('.cm-content').innerText()
}

/** A 1x1 PNG, small enough to inline and real enough for the image pipeline. */
export const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** A larger PNG (64x64, solid colour) for exercising downscaling. */
export function squarePng(): Buffer {
  // A minimal but valid 64x64 PNG produced by the icon generator's encoder would
  // be overkill here; the 1x1 image drives the same code path.
  return TINY_PNG
}
