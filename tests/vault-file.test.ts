import { beforeEach, describe, expect, it } from 'vitest'
import { NoterDB, db } from '$lib/db/db'
import { describeVault, exportVault, importVault, readHeader, VaultFileError } from '$lib/backup/vault-file'
import * as notesRepo from '$lib/db/repo/notes'
import * as foldersRepo from '$lib/db/repo/folders'

let counter = 0

/** Points the shared `db` instance at a fresh store for each test. */
async function useFreshDb(): Promise<NoterDB> {
  const fresh = new NoterDB(`noter-vault-${counter++}`)
  await fresh.open()
  Object.assign(db, {
    notes: fresh.notes,
    folders: fresh.folders,
    assets: fresh.assets,
    versions: fresh.versions,
    smartFolders: fresh.smartFolders,
    themes: fresh.themes,
    settings: fresh.settings,
    transaction: fresh.transaction.bind(fresh),
  })
  return fresh
}

function fakeAsset(id: string) {
  return {
    id,
    hash: id,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/webp' }),
    thumb: new Blob([new Uint8Array([5, 6])], { type: 'image/webp' }),
    mime: 'image/webp',
    width: 2,
    height: 2,
    bytes: 4,
    origin: 'paste' as const,
    sourceUrl: null,
    createdAt: 1,
  }
}

const ASSET_ID = '11111111-1111-4111-8111-111111111111'

async function seed() {
  const folder = await foldersRepo.createFolder({ name: 'Projects' })
  const note = await notesRepo.createNote({
    title: 'Kept note',
    body: `Body with an image ![[img:${ASSET_ID}]]`,
    folderId: folder.id,
  })
  await db.assets.add(fakeAsset(ASSET_ID))
  return { folder, note }
}

describe('vault file', () => {
  beforeEach(async () => {
    await useFreshDb()
  })

  it('round-trips the whole workspace unencrypted', async () => {
    const { note, folder } = await seed()
    const file = await exportVault()

    await useFreshDb()
    expect(await notesRepo.listAll()).toHaveLength(0)

    const result = await importVault(file, 'replace')
    expect(result.notes).toBe(1)
    expect(result.assets).toBe(1)

    const restored = await db.notes.get(note.id)
    expect(restored?.title).toBe('Kept note')
    expect(restored?.folderId).toBe(folder.id)
    expect((await db.folders.get(folder.id))?.name).toBe('Projects')
  })

  it('restores image bytes exactly', async () => {
    await seed()
    const file = await exportVault()

    await useFreshDb()
    await importVault(file, 'replace')

    const asset = await db.assets.get(ASSET_ID)
    expect(asset).toBeDefined()
    expect([...new Uint8Array(await asset!.blob.arrayBuffer())]).toEqual([1, 2, 3, 4])
    expect([...new Uint8Array(await asset!.thumb.arrayBuffer())]).toEqual([5, 6])
  })

  it('round-trips with a passphrase', async () => {
    const { note } = await seed()
    const file = await exportVault({ passphrase: 'a good passphrase' })

    await useFreshDb()
    await importVault(file, 'replace', 'a good passphrase')
    expect((await db.notes.get(note.id))?.title).toBe('Kept note')
  })

  it('describes an encrypted backup without the passphrase', async () => {
    await seed()
    const header = await describeVault(await exportVault({ passphrase: 'secret' }))
    expect(header.encrypted).toBe(true)
    expect(header.counts.notes).toBe(1)
    expect(header.counts.assets).toBe(1)
  })

  it('refuses the wrong passphrase', async () => {
    await seed()
    const file = await exportVault({ passphrase: 'right' })
    await useFreshDb()
    await expect(importVault(file, 'replace', 'wrong')).rejects.toThrow(VaultFileError)
  })

  it('refuses to open an encrypted backup with no passphrase', async () => {
    await seed()
    const file = await exportVault({ passphrase: 'secret' })
    await useFreshDb()
    await expect(importVault(file, 'replace')).rejects.toThrow(/passphrase is required/i)
  })

  it('rejects a file that is not a vault', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(() => readHeader(bytes)).toThrow(/not a Noter backup/i)
  })

  it('rejects a truncated vault', async () => {
    await seed()
    const bytes = new Uint8Array(await (await exportVault()).arrayBuffer())
    expect(() => readHeader(bytes.subarray(0, 8))).toThrow()
  })

  it('detects tampering with an encrypted payload', async () => {
    await seed()
    const bytes = new Uint8Array(await (await exportVault({ passphrase: 'secret' })).arrayBuffer())
    // AES-GCM authenticates, so flipping one byte must make the import fail.
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 0xff

    await useFreshDb()
    await expect(importVault(new Blob([bytes]), 'replace', 'secret')).rejects.toThrow(VaultFileError)
  })

  it('merging keeps whichever copy was edited most recently', async () => {
    const { note } = await seed()
    const file = await exportVault()

    // Edit locally after the backup was taken; a merge must not clobber it.
    await notesRepo.updateNote(note.id, { title: 'Edited here', body: 'newer' })
    const result = await importVault(file, 'merge')

    expect(result.skipped).toBeGreaterThan(0)
    expect((await db.notes.get(note.id))?.title).toBe('Edited here')
  })

  it('merging takes the backup when the backup is newer', async () => {
    const { note } = await seed()
    await notesRepo.updateNote(note.id, { title: 'Newer in backup' })
    const file = await exportVault()

    await useFreshDb()
    await notesRepo.createNote({ title: 'Older' })
    await db.notes.put({
      ...(await notesRepo.getNote((await notesRepo.listAll())[0]!.id))!,
      id: note.id,
      updatedAt: 1,
    })

    await importVault(file, 'merge')
    expect((await db.notes.get(note.id))?.title).toBe('Newer in backup')
  })

  it('replace wipes anything not in the backup', async () => {
    await seed()
    const file = await exportVault()

    await useFreshDb()
    const stray = await notesRepo.createNote({ title: 'Should be gone' })
    await importVault(file, 'replace')

    expect(await db.notes.get(stray.id)).toBeUndefined()
  })
})
