import { expect, test, type Page } from '@playwright/test'
import { APP_READY } from './helpers'

const MASTER = 'correct horse battery staple'
const CANARY = 'Canary-Pa55word-7731'

async function createVault(page: Page) {
  await page.getByTestId('vault-password').fill(MASTER)
  await page.getByTestId('vault-confirm').fill(MASTER)
  await page.getByTestId('vault-ack').check()
  await page.getByRole('button', { name: 'Create vault' }).click()
  await expect(page.getByTestId('add-secret')).toBeVisible()
}

async function addLogin(page: Page, title: string, username: string, password: string) {
  await page.getByTestId('add-secret').click()
  const editor = page.getByTestId('secret-editor')
  await editor.getByLabel('Name', { exact: true }).fill(title)
  await editor.getByTestId('field-username').fill(username)
  await editor.getByTestId('field-password').fill(password)
  await editor.getByTestId('save-secret').click()
  await expect(editor).toBeHidden()
}

/** Every string stored anywhere in IndexedDB, flattened. */
async function everythingStored(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open('noter')
      open.onsuccess = () => resolve(open.result)
    })
    const parts: string[] = []
    for (const name of Array.from(database.objectStoreNames)) {
      const rows = await new Promise<unknown[]>((resolve) => {
        const request = database.transaction(name, 'readonly').objectStore(name).getAll()
        request.onsuccess = () => resolve(request.result)
      })
      parts.push(JSON.stringify(rows))
    }
    database.close()
    return parts.join('\n')
  })
}

test.describe('vault', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/vault')
    await page.waitForSelector(APP_READY)
    await expect(page.getByTestId('vault')).toBeVisible()
  })

  test('sets up, stores a login and reveals it on demand', async ({ page }) => {
    await createVault(page)
    await addLogin(page, 'Email', 'me@example.com', CANARY)

    await expect(page.getByTestId('secret-item')).toHaveCount(1)
    const detail = page.getByTestId('secret-detail')
    await expect(detail).toContainText('me@example.com')
    // The password stays masked until asked for.
    await expect(detail.getByTestId('value-password')).not.toContainText(CANARY)
    await detail.getByRole('button', { name: 'Show' }).click()
    await expect(detail.getByTestId('value-password')).toHaveText(CANARY)
  })

  test('locks, rejects a wrong password and opens with the right one', async ({ page }) => {
    await createVault(page)
    await addLogin(page, 'Bank', 'alice', CANARY)

    await page.getByTestId('lock-vault').click()
    await expect(page.getByTestId('secret-item')).toHaveCount(0)

    await page.getByTestId('vault-password').fill('not the password')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByRole('alert')).toContainText('That password is not right.')

    await page.getByTestId('vault-password').fill(MASTER)
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByTestId('secret-item')).toHaveCount(1)

    // Still locked after a reload: the key only ever lives in memory.
    await page.reload()
    await expect(page.getByTestId('vault-password')).toBeVisible()
  })

  test('never writes a secret to the database in the clear', async ({ page }) => {
    await createVault(page)
    await addLogin(page, 'Canary entry', 'canary-user', CANARY)
    await expect(page.getByTestId('secret-item')).toHaveCount(1)

    const stored = await everythingStored(page)
    expect(stored).toContain('noter:sec:v1:')
    expect(stored).not.toContain(CANARY)
    expect(stored).not.toContain('canary-user')
    // The title is sealed too: a list of site names is itself sensitive.
    expect(stored).not.toContain('Canary entry')
    expect(stored).not.toContain(MASTER)
  })

  test('locks itself when the app is hidden', async ({ page }) => {
    await createVault(page)
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(page.getByTestId('vault-password')).toBeVisible()
  })

  test('copies from the context menu and deletes with undo', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await createVault(page)
    await addLogin(page, 'Forum', 'bob', CANARY)

    await page.getByTestId('secret-item').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Copy Password' }).click()
    await expect(page.getByTestId('toast').filter({ hasText: 'clipboard is cleared' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(CANARY)

    await page.getByTestId('secret-item').click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await expect(page.getByTestId('secret-item')).toHaveCount(0)
    await page.getByTestId('toast').getByRole('button', { name: 'Undo' }).click()
    await expect(page.getByTestId('secret-item')).toHaveCount(1)
  })
})
