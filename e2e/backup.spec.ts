import { expect, test, type Page } from '@playwright/test'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createFolder,
  createNoteWith,
  noteMenu,
  notePersisted,
  openApp,
  openSettings,
  TINY_PNG,
} from './helpers'

const VAULT_PASSPHRASE = 'a backup passphrase'

async function downloadTo(page: Page, trigger: () => Promise<void>): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'noter-e2e-'))
  const waitFor = page.waitForEvent('download')
  await trigger()
  const download = await waitFor
  const target = join(directory, download.suggestedFilename())
  await download.saveAs(target)
  return target
}

/** Seeds a workspace worth backing up: a folder, two notes and an image. */
async function seedWorkspace(page: Page) {
  await createFolder(page, 'Projects')
  await createNoteWith(page, 'Kept note\nThe body that must survive.')

  const chooser = page.waitForEvent('filechooser')
  await noteMenu(page, 'Add images')
  await (await chooser).setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: TINY_PNG })
  await expect(page.locator('.cm-inline-image')).toHaveCount(1)
  // The reference must be committed, not merely rendered, before a backup runs.
  await expect.poll(() => notePersisted(page, '![[img:')).toBe(true)

  await createNoteWith(page, 'Second note\nAlso worth keeping.')
}

test.describe('backup and restore', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page)
  })

  test('round-trips an encrypted vault into a clean browser', async ({ page, browser }) => {
    await seedWorkspace(page)

    await openSettings(page)
    await page.getByLabel('Vault passphrase (optional)').fill(VAULT_PASSPHRASE)
    const vault = await downloadTo(page, () => page.getByRole('button', { name: 'Export vault' }).click())

    // A brand-new context has an empty origin: nothing carries over but the file.
    const fresh = await browser.newContext()
    const restored = await fresh.newPage()
    await restored.goto('/')
    await restored.waitForSelector('[data-testid="view-all"]')
    await expect(restored.getByTestId('note-item')).toHaveCount(0)

    await restored.getByTestId('open-settings').click()
    const chooser = restored.waitForEvent('filechooser')
    await restored.getByRole('button', { name: 'Import vault…' }).click()
    await (await chooser).setFiles(vault)

    await expect(restored.getByTestId('restore-preview')).toBeVisible()
    await expect(restored.getByTestId('restore-preview')).toContainText('2 notes')

    await restored.getByLabel('Backup passphrase').fill(VAULT_PASSPHRASE)
    await restored.getByRole('button', { name: 'Replace everything' }).click()
    await restored.getByTestId('confirm-restore').click()

    await expect(restored.getByTestId('toast').filter({ hasText: 'Restored' })).toBeVisible()
    await restored.getByLabel('Close settings').click()

    await expect(restored.getByTestId('note-item')).toHaveCount(2)
    await expect(restored.getByRole('tree')).toContainText('Projects')

    // The note body and its image must both come back.
    await restored.getByTestId('note-item').filter({ hasText: 'Kept note' }).click()
    await expect(restored.locator('.cm-content')).toContainText('The body that must survive.')
    await expect(restored.locator('.cm-inline-image img')).toHaveAttribute('src', /^blob:/)

    await fresh.close()
  })

  test('refuses an encrypted vault with the wrong passphrase', async ({ page, browser }) => {
    await createNoteWith(page, 'Protected note\nContents.')

    await openSettings(page)
    await page.getByLabel('Vault passphrase (optional)').fill(VAULT_PASSPHRASE)
    const vault = await downloadTo(page, () => page.getByRole('button', { name: 'Export vault' }).click())

    const fresh = await browser.newContext()
    const restored = await fresh.newPage()
    await restored.goto('/')
    await restored.waitForSelector('[data-testid="view-all"]')

    await restored.getByTestId('open-settings').click()
    const chooser = restored.waitForEvent('filechooser')
    await restored.getByRole('button', { name: 'Import vault…' }).click()
    await (await chooser).setFiles(vault)

    await restored.getByLabel('Backup passphrase').fill('wrong passphrase entirely')
    await restored.getByTestId('confirm-restore').click()

    await expect(restored.getByText(/Wrong passphrase/)).toBeVisible()
    await restored.getByLabel('Close settings').click()
    await expect(restored.getByTestId('note-item')).toHaveCount(0)

    await fresh.close()
  })

  test('exports an unencrypted vault and restores it', async ({ page, browser }) => {
    await createNoteWith(page, 'Plain backup\nNo passphrase used.')

    await openSettings(page)
    const vault = await downloadTo(page, () => page.getByRole('button', { name: 'Export vault' }).click())

    const fresh = await browser.newContext()
    const restored = await fresh.newPage()
    await restored.goto('/')
    await restored.waitForSelector('[data-testid="view-all"]')

    await restored.getByTestId('open-settings').click()
    const chooser = restored.waitForEvent('filechooser')
    await restored.getByRole('button', { name: 'Import vault…' }).click()
    await (await chooser).setFiles(vault)

    // No passphrase field for an unencrypted backup.
    await expect(restored.getByTestId('restore-preview')).toBeVisible()
    await expect(restored.getByLabel('Backup passphrase')).toHaveCount(0)

    await restored.getByRole('button', { name: 'Replace everything' }).click()
    await restored.getByTestId('confirm-restore').click()
    await restored.getByLabel('Close settings').click()

    await expect(restored.getByTestId('note-item')).toHaveCount(1)
    await fresh.close()
  })

  test('merging keeps the copy that was edited most recently', async ({ page }) => {
    await createNoteWith(page, 'Original text\nVersion one.')

    await openSettings(page)
    const vault = await downloadTo(page, () => page.getByRole('button', { name: 'Export vault' }).click())
    await page.getByLabel('Close settings').click()

    // Edit after the backup was taken; a merge must not overwrite the newer text.
    await page.getByTestId('note-item').first().click()
    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' Version two.')
    await expect(page.getByTestId('note-item').first()).toContainText('Version two')

    await openSettings(page)
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Import vault…' }).click()
    await (await chooser).setFiles(vault)
    await expect(page.getByTestId('restore-preview')).toBeVisible()
    // Merge is the default mode.
    await page.getByTestId('confirm-restore').click()
    await expect(page.getByTestId('toast').filter({ hasText: 'Restored' })).toBeVisible()
    await page.getByLabel('Close settings').click()

    await page.getByTestId('note-item').first().click()
    await expect(page.locator('.cm-content')).toContainText('Version two.')
  })

  test('rejects a file that is not a vault', async ({ page }) => {
    await openSettings(page)
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Import vault…' }).click()
    await (await chooser).setFiles({
      name: 'not-a-vault.noter',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('this is definitely not a backup'),
    })

    await expect(page.getByText('not a Noter backup file')).toBeVisible()
    await expect(page.getByTestId('restore-preview')).toHaveCount(0)
  })

  test('exports a Markdown archive and imports it back', async ({ page, browser }) => {
    await createFolder(page, 'Archived project')
    await createNoteWith(page, 'Markdown note\nPlain text body.')

    await openSettings(page)
    const zip = await downloadTo(page, () =>
      page.getByRole('button', { name: 'Export Markdown zip' }).click(),
    )

    const fresh = await browser.newContext()
    const restored = await fresh.newPage()
    await restored.goto('/')
    await restored.waitForSelector('[data-testid="view-all"]')

    await restored.getByTestId('open-settings').click()
    const chooser = restored.waitForEvent('filechooser')
    await restored.getByRole('button', { name: 'Import Markdown zip…' }).click()
    await (await chooser).setFiles(zip)

    await expect(restored.getByTestId('toast').filter({ hasText: 'Imported' })).toBeVisible()
    await restored.getByLabel('Close settings').click()

    await expect(restored.getByTestId('note-item')).toHaveCount(1)
    // The folder tree is rebuilt from the archive's paths.
    await expect(restored.getByRole('tree')).toContainText('Archived project')

    await fresh.close()
  })

  test('keeps a version history and restores an earlier one', async ({ page }) => {
    await createNoteWith(page, 'Versioned note\nFirst draft.')

    // Leaving the note is what snapshots it.
    await createNoteWith(page, 'Another note')
    await page.getByTestId('note-item').filter({ hasText: 'Versioned note' }).click()

    await page.locator('.cm-content').click()
    await page.keyboard.press('Control+End')
    await page.keyboard.type(' Second draft.')
    await expect(page.getByTestId('note-item').first()).toContainText('Second draft')

    await noteMenu(page, 'History')
    await expect(page.getByTestId('history-dialog')).toBeVisible()
    await expect(page.getByTestId('version-entry')).toHaveCount(1)
    await expect(page.locator('.line--added')).toHaveCount(1)

    await page.getByTestId('history-restore').click()
    await expect(page.locator('.cm-content')).not.toContainText('Second draft.')
    await expect(page.locator('.cm-content')).toContainText('First draft.')
  })

  test('shares a note through a link that carries it', async ({ page, browser }) => {
    await createNoteWith(page, 'Shared note\nSomething worth sending.')

    await noteMenu(page, 'Share a copy')
    await expect(page.getByTestId('share-dialog')).toBeVisible()
    await expect(page.getByTestId('share-dialog')).toContainText('Images are not shared')

    await expect
      .poll(() => page.getByTestId('share-url').inputValue())
      .toMatch(/#\/s\//)
    const link = await page.getByTestId('share-url').inputValue()
    await page.getByTestId('share-close').click()

    // A clean browser with no database of its own must still render it.
    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    await guestPage.goto(link)

    await expect(guestPage.getByText('Shared note').first()).toBeVisible()
    await expect(guestPage.locator('.prose')).toContainText('Something worth sending.')

    await guestPage.getByRole('button', { name: 'Save to my notes' }).click()
    await expect(guestPage.getByTestId('note-item')).toHaveCount(1)

    await guest.close()
  })

  test('leaves images out of a shared link and says so', async ({ page, browser }) => {
    await createNoteWith(page, 'Illustrated note\nWith a picture below.')

    const chooser = page.waitForEvent('filechooser')
    await noteMenu(page, 'Add images')
    await (await chooser).setFiles({ name: 'shot.png', mimeType: 'image/png', buffer: TINY_PNG })
    await expect(page.locator('.cm-inline-image')).toHaveCount(1)

    await noteMenu(page, 'Share a copy')
    await expect(page.getByTestId('share-dialog')).toContainText('This note has 1 image')

    await expect.poll(() => page.getByTestId('share-url').inputValue()).toMatch(/#\/s\//)
    const link = await page.getByTestId('share-url').inputValue()
    // A data URL in the link would mean an image slipped through.
    expect(link).not.toContain('data:image')

    const guest = await browser.newContext()
    const guestPage = await guest.newPage()
    await guestPage.goto(link)

    await expect(guestPage.locator('.prose')).toContainText('With a picture below.')
    // The recipient sees an explanation, not a broken-image error.
    await expect(guestPage.locator('.missing-image--expected')).toContainText(
      'Image not included in this link',
    )

    await guest.close()
  })

  test('reports a corrupted share link instead of rendering nothing', async ({ page }) => {
    await page.goto('/#/s/this-is-not-a-valid-payload')
    await expect(page.getByText('This link could not be read')).toBeVisible()
  })
})
