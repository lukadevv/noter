import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  createFolder,
  createNote,
  createNoteWith,
  folderMenu,
  noteBodies,
  openApp,
  typeMarkdown,
} from './helpers'

const PASSPHRASE = 'a decent folder passphrase'

/** Encrypts the folder in `row` and waits for the notes to be rewritten. */
async function encryptFolder(page: Page, row: Locator) {
  await folderMenu(page, row, 'Encrypt folder')
  await expect(page.getByTestId('folder-lock')).toBeVisible()

  await page.getByLabel('Passphrase', { exact: true }).fill(PASSPHRASE)
  await page.getByLabel('Repeat it').fill(PASSPHRASE)
  await page.getByTestId('ack-no-recovery').check()
  await page.getByRole('button', { name: 'Encrypt folder' }).click()

  await expect(page.getByTestId('toast').filter({ hasText: 'encrypted' })).toBeVisible()
  await expect(page.getByTestId('folder-lock')).toBeHidden()
}

test.describe('folder encryption', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('locks a folder and unlocks it again with the right passphrase', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Secret plans\nThe contents of the note.')

    await encryptFolder(page, row)

    // Reloading drops the in-memory key, which is the whole point.
    await page.reload()
    await page.getByTestId('note-item').first().click()

    await expect(page.getByTestId('lock-prompt')).toBeVisible()
    await expect(page.getByTestId('note-item').first()).toContainText('Locked note')

    await page.getByLabel('Folder passphrase').fill(PASSPHRASE)
    await page.getByRole('button', { name: 'Unlock' }).click()

    await expect(page.locator('.cm-content')).toContainText('The contents of the note.')
  })

  test('encrypts the notes of a subfolder along with its parent', async ({ page }) => {
    const parent = await createFolder(page, 'Private')
    await folderMenu(page, parent, 'New subfolder')
    const rows = page.getByRole('tree').getByTestId('folder-row')
    await expect(rows).toHaveCount(2)
    await rows.nth(1).getByTestId('folder-label').click()
    await createNoteWith(page, 'Nested secret\nCHILD-CANARY lives in the subfolder.')

    await encryptFolder(page, parent)

    // The subfolder has no passphrase of its own, yet its note is ciphertext too.
    expect((await noteBodies(page)).join('\n')).not.toContain('CHILD-CANARY')
    await expect(rows.nth(1).locator('.lock')).toBeVisible()

    await page.reload()
    await page.getByTestId('view-all').click()
    await expect(page.getByTestId('note-item').first()).toContainText('Locked note')
    await page.getByTestId('note-item').first().click()
    await page.getByLabel('Folder passphrase').fill(PASSPHRASE)
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.locator('.cm-content')).toContainText('CHILD-CANARY')
  })

  test('hides a note left in the clear in a subfolder until the parent is unlocked, then seals it', async ({
    page,
  }) => {
    const parent = await createFolder(page, 'Private')
    await folderMenu(page, parent, 'New subfolder')
    const rows = page.getByRole('tree').getByTestId('folder-row')
    await expect(rows).toHaveCount(2)
    await rows.nth(1).getByTestId('folder-label').click()
    await createNoteWith(page, 'Nested secret\nsome text')
    await encryptFolder(page, parent)

    // What a subfolder made before it inherited the lock looks like: a plaintext
    // note next to the sealed ones.
    await page.evaluate(async () => {
      const open = indexedDB.open('noter')
      const database = await new Promise<IDBDatabase>((resolve) => {
        open.onsuccess = () => resolve(open.result)
      })
      const store = () => database.transaction('notes', 'readwrite').objectStore('notes')
      const rows = await new Promise<Record<string, unknown>[]>((resolve) => {
        const request = store().getAll()
        request.onsuccess = () => resolve(request.result as Record<string, unknown>[])
      })
      const legacy = {
        ...rows[0],
        id: 'legacy-note',
        encrypted: 0,
        title: 'LEGACY-TITLE',
        body: 'LEGACY-BODY',
      }
      await new Promise<void>((resolve) => {
        const request = store().put(legacy)
        request.onsuccess = () => resolve()
      })
      database.close()
    })

    await page.reload()
    await page.getByTestId('view-all').click()
    await expect(page.getByTestId('note-item')).toHaveCount(2)
    await expect(page.getByTestId('note-item').filter({ hasText: 'Locked note' })).toHaveCount(2)
    await expect(page.getByText('LEGACY-TITLE')).toHaveCount(0)

    await page.keyboard.press('Control+k')
    await page.getByTestId('palette-input').fill('LEGACY')
    await expect(page.getByTestId('palette-row').filter({ hasText: 'LEGACY' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Unlocking seals it.
    await page.getByTestId('note-item').first().click()
    await page.getByLabel('Folder passphrase').fill(PASSPHRASE)
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect.poll(async () => (await noteBodies(page)).join('\n')).not.toContain('LEGACY-BODY')
  })

  test('encrypts a note made in a new subfolder of an unlocked encrypted folder', async ({ page }) => {
    const parent = await createFolder(page, 'Private')
    await createNoteWith(page, 'Parent note\nsome text')
    await encryptFolder(page, parent)

    await folderMenu(page, parent, 'New subfolder')
    const rows = page.getByRole('tree').getByTestId('folder-row')
    await expect(rows).toHaveCount(2)
    await rows.nth(1).getByTestId('folder-label').click()
    // The list shows "Locked note" for it, so there is no title to wait for.
    await createNote(page)
    await typeMarkdown(page, 'Fresh child\nFRESH-CANARY must never be stored.')

    await expect
      .poll(async () => {
        const bodies = await noteBodies(page)
        return bodies.length === 2 && bodies.every((body) => body.startsWith('noter:enc:v1:'))
      })
      .toBe(true)
    expect((await noteBodies(page)).join('\n')).not.toContain('FRESH-CANARY')
  })

  test('rejects the wrong passphrase', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Secret plans\nThe contents.')
    await encryptFolder(page, row)

    await page.reload()
    await page.getByTestId('note-item').first().click()

    await page.getByLabel('Folder passphrase').fill('not the passphrase')
    await page.getByRole('button', { name: 'Unlock' }).click()

    await expect(page.getByText('does not open this folder')).toBeVisible()
    await expect(page.locator('.cm-content')).toHaveCount(0)
  })

  test('stores nothing readable on disk while locked', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Secret plans\nTHE-CANARY-STRING lives here.')
    await encryptFolder(page, row)

    // The canary must not appear anywhere in the note store.
    const leaked = await page.evaluate(async () => {
      const open = indexedDB.open('noter')
      const database = await new Promise<IDBDatabase>((resolve) => {
        open.onsuccess = () => resolve(open.result)
      })
      const rows = await new Promise<unknown[]>((resolve) => {
        const request = database.transaction('notes', 'readonly').objectStore('notes').getAll()
        request.onsuccess = () => resolve(request.result as unknown[])
      })
      database.close()
      return JSON.stringify(rows).includes('THE-CANARY-STRING')
    })

    expect(leaked).toBe(false)
  })

  test('keeps locked notes out of search', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Secret plans\nUNIQUEWORD appears only here.')
    await encryptFolder(page, row)

    await page.reload()
    await page.keyboard.press('Control+k')
    await page.getByTestId('palette-input').fill('UNIQUEWORD')

    await expect(page.getByTestId('palette-row').filter({ hasText: 'Secret plans' })).toHaveCount(0)
  })

  test('does not offer an encrypted note when completing a link', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Hidden title\nNobody should see the title.')
    await encryptFolder(page, row)

    // A note outside the folder, with a link being typed.
    await page.getByText('All notes').click()
    await page.getByTestId('new-note').click()
    await page.locator('.cm-content').click()
    await page.keyboard.type('see [[')
    await page.keyboard.type('n')

    // The menu takes a moment to open; without the fix it lists the ciphertext.
    await page.waitForTimeout(500)
    await expect(page.locator('.cm-tooltip-autocomplete', { hasText: 'noter:enc' })).toHaveCount(0)
  })

  test('drops the tags of an encrypted note', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Tagged secret\nWith a #confidential tag.')
    await expect(page.getByTestId('tag-chip')).toHaveCount(1)

    await encryptFolder(page, row)
    await expect(page.getByTestId('tag-chip')).toHaveCount(0)
  })

  test('removes encryption and restores the plain text', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Secret plans\nBack to plain text.')
    await encryptFolder(page, row)

    // Still unlocked from encrypting, so removal is allowed straight away.
    await folderMenu(page, row, 'Encryption')
    await page.getByRole('button', { name: 'Remove encryption' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'decrypted' })).toBeVisible()

    await page.reload()
    await page.getByTestId('note-item').first().click()
    await expect(page.locator('.cm-content')).toContainText('Back to plain text.')
  })

  test('re-locks a folder on demand', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await createNoteWith(page, 'Secret plans\nStill secret.')
    await encryptFolder(page, row)

    await folderMenu(page, row, 'Encryption')
    await page.getByRole('button', { name: 'Lock now' }).click()
    // Scoped to the dialog: a toast may still be on screen with its own control.
    await page.getByTestId('folder-lock').getByLabel('Close').click()

    await page.getByTestId('note-item').first().click()
    await expect(page.getByTestId('lock-prompt')).toBeVisible()
  })

  test('refuses to encrypt without a confirmed passphrase', async ({ page }) => {
    const row = await createFolder(page, 'Private')
    await folderMenu(page, row, 'Encrypt folder')

    const encrypt = page.getByRole('button', { name: 'Encrypt folder' })
    await expect(encrypt).toBeDisabled()

    await page.getByLabel('Passphrase', { exact: true }).fill('short')
    await page.getByLabel('Repeat it').fill('short')
    await page.getByTestId('ack-no-recovery').check()
    // Under eight characters, so it stays disabled.
    await expect(encrypt).toBeDisabled()

    await page.getByLabel('Passphrase', { exact: true }).fill('long enough now')
    await page.getByLabel('Repeat it').fill('but different')
    await expect(encrypt).toBeDisabled()

    await page.getByLabel('Repeat it').fill('long enough now')
    await expect(encrypt).toBeEnabled()
  })
})
