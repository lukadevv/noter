import { beforeEach, describe, expect, it } from 'vitest'
import { useFreshDb } from './helpers/fresh-db'
import { db } from '$lib/db/db'
import { ROOT } from '$lib/db/schema'
import * as notesRepo from '$lib/db/repo/notes'
import * as foldersRepo from '$lib/db/repo/folders'
import { purgeOrphanAssets } from '$lib/db/repo/assets'
import {
  FolderLockedError,
  decryptFolder,
  encryptFolder,
  finishNoteMove,
  keyring,
  moveFolderWithNotes,
  planNoteMove,
  revealInFolder,
  revealNote,
} from '$lib/crypto/keyring.svelte'
import { isEncrypted } from '$lib/crypto/vault'

const IMG = '11111111-1111-4111-8111-111111111111'
const PASS = 'correct horse battery'

function fakeAsset(id: string) {
  const blob = new Blob(['x'])
  return {
    id,
    hash: id,
    blob,
    thumb: blob,
    mime: 'image/webp',
    width: 1,
    height: 1,
    bytes: 1,
    origin: 'paste' as const,
    sourceUrl: null,
    createdAt: 0,
  }
}

describe('folder encryption', () => {
  beforeEach(async () => {
    await useFreshDb('noter-keyring')
    keyring.lockAll()
  })

  it('keeps the images of encrypted notes through the orphan sweep', async () => {
    const folder = await foldersRepo.createFolder({ name: 'Secret' })
    await db.assets.add(fakeAsset(IMG))
    await notesRepo.createNote({ folderId: folder.id, body: `![[img:${IMG}]]` })
    await encryptFolder(folder.id, PASS)

    expect(await purgeOrphanAssets()).toBe(0)
    expect(await db.assets.get(IMG)).toBeDefined()
  })

  it('encrypts existing history along with the notes', async () => {
    const folder = await foldersRepo.createFolder({ name: 'Secret' })
    const note = await notesRepo.createNote({ folderId: folder.id, body: 'canary text' })
    await db.versions.add({ id: 'v1', noteId: note.id, title: '', body: 'canary text', createdAt: 1 })
    await encryptFolder(folder.id, PASS)

    const version = await db.versions.get('v1')
    expect(isEncrypted(version!.body)).toBe(true)
    expect(await revealInFolder(folder.id, version!.body)).toBe('canary text')
  })

  it('re-seals a note moved between encrypted and plain folders', async () => {
    const secret = await foldersRepo.createFolder({ name: 'Secret' })
    const plain = await foldersRepo.createFolder({ name: 'Plain' })
    const note = await notesRepo.createNote({ folderId: plain.id, body: 'hello #tag' })
    await encryptFolder(secret.id, PASS)

    const inPlan = await planNoteMove(note, secret.id)
    expect(inPlan?.patch.encrypted).toBe(1)
    expect(isEncrypted(inPlan!.patch.body!)).toBe(true)
    await notesRepo.moveNote(note.id, secret.id, null, null, inPlan!.patch)
    await finishNoteMove(inPlan)

    const moved = (await notesRepo.getNote(note.id))!
    expect((await revealNote(moved))?.body).toBe('hello #tag')

    const outPlan = await planNoteMove(moved, plain.id)
    expect(outPlan?.patch).toMatchObject({ body: 'hello #tag', encrypted: 0, tags: ['tag'] })

    keyring.lock(secret.id)
    await expect(planNoteMove(moved, plain.id)).rejects.toBeInstanceOf(FolderLockedError)
  })

  it('moves a note between folders of one encrypted tree without touching it', async () => {
    const secret = await foldersRepo.createFolder({ name: 'Secret' })
    const inner = await foldersRepo.createFolder({ name: 'Inner', parentId: secret.id })
    const note = await notesRepo.createNote({ folderId: secret.id, body: 'same key' })
    await encryptFolder(secret.id, PASS)
    const sealed = (await notesRepo.getNote(note.id))!

    expect(await planNoteMove(sealed, inner.id)).toBeNull()
  })
})

describe('encryption inherited by subfolders', () => {
  beforeEach(async () => {
    await useFreshDb('noter-keyring-tree')
    keyring.lockAll()
  })

  async function tree() {
    const parent = await foldersRepo.createFolder({ name: 'Parent' })
    const child = await foldersRepo.createFolder({ name: 'Child', parentId: parent.id })
    const inParent = await notesRepo.createNote({ folderId: parent.id, body: 'parent text' })
    const inChild = await notesRepo.createNote({ folderId: child.id, body: 'child text' })
    return { parent, child, inParent, inChild }
  }

  it('encrypts the notes of subfolders with the parent key', async () => {
    const { parent, child, inChild } = await tree()
    await encryptFolder(parent.id, PASS)

    expect(keyring.rootOf(child.id)).toBe(parent.id)
    const stored = (await notesRepo.getNote(inChild.id))!
    expect(stored.encrypted).toBe(1)
    expect(isEncrypted(stored.body)).toBe(true)
    expect((await revealNote(stored))?.body).toBe('child text')
    // The child never got a passphrase of its own.
    expect((await db.folders.get(child.id))!.kdf).toBeNull()
  })

  it('locks and unlocks a subfolder together with its parent', async () => {
    const { parent, child } = await tree()
    await encryptFolder(parent.id, PASS)
    expect(keyring.isUnlocked(child.id)).toBe(true)

    keyring.lock(child.id)
    expect(keyring.isUnlocked(parent.id)).toBe(false)
    expect(keyring.keyFor(child.id)).toBeNull()

    expect(await keyring.unlock(child.id, PASS)).toBe(true)
    expect(keyring.isUnlocked(parent.id)).toBe(true)
  })

  it('seals a note that was left in the clear, when its folder is next unlocked', async () => {
    const { parent, child } = await tree()
    await encryptFolder(parent.id, PASS)
    keyring.lock(parent.id)
    // The state of a subfolder made before it inherited the lock.
    const late = await notesRepo.createNote({ folderId: child.id, body: 'left behind' })
    await db.versions.add({ id: 'v2', noteId: late.id, title: '', body: 'left behind', createdAt: 1 })

    expect(await keyring.unlock(parent.id, PASS)).toBe(true)

    const stored = (await notesRepo.getNote(late.id))!
    expect(stored.encrypted).toBe(1)
    expect(stored.updatedAt).toBe(late.updatedAt)
    expect(isEncrypted(stored.body)).toBe(true)
    expect(isEncrypted((await db.versions.get('v2'))!.body)).toBe(true)
  })

  it('removes the encryption from the subfolders that relied on it, but not from their own', async () => {
    const { parent, child, inChild } = await tree()
    const own = await foldersRepo.createFolder({ name: 'Own key', parentId: child.id })
    const inOwn = await notesRepo.createNote({ folderId: own.id, body: 'own text' })
    await encryptFolder(own.id, 'another passphrase')
    await encryptFolder(parent.id, PASS)

    await decryptFolder(parent.id)

    expect(await notesRepo.getNote(inChild.id)).toMatchObject({ encrypted: 0, body: 'child text' })
    expect((await notesRepo.getNote(inOwn.id))!.encrypted).toBe(1)
    expect(keyring.rootOf(own.id)).toBe(own.id)
    expect(keyring.rootOf(child.id)).toBeNull()
  })

  it('is not undone by the sweep that seals notes left in the clear', async () => {
    const { parent, inChild } = await tree()
    await encryptFolder(parent.id, PASS)

    // The notes store runs this whenever it sees an unsealed note in an unlocked folder.
    const sweeping = setInterval(() => void keyring.sealPending(parent.id), 0)
    try {
      await decryptFolder(parent.id)
    } finally {
      clearInterval(sweeping)
    }
    await keyring.sealPending(parent.id)

    expect(await notesRepo.getNote(inChild.id)).toMatchObject({ encrypted: 0, body: 'child text' })
  })

  it('seals a folder moved into an encrypted one, and opens it again on the way out', async () => {
    const { parent, inParent } = await tree()
    await encryptFolder(parent.id, PASS)
    const moving = await foldersRepo.createFolder({ name: 'Moving' })
    const note = await notesRepo.createNote({ folderId: moving.id, body: 'travels #x' })
    await db.versions.add({ id: 'v3', noteId: note.id, title: '', body: 'travels #x', createdAt: 1 })

    expect(await moveFolderWithNotes(moving.id, parent.id, null, null)).toBe(true)
    const inside = (await notesRepo.getNote(note.id))!
    expect(inside.encrypted).toBe(1)
    expect((await revealNote(inside))?.body).toBe('travels #x')
    expect(isEncrypted((await db.versions.get('v3'))!.body)).toBe(true)

    expect(await moveFolderWithNotes(moving.id, ROOT, null, null)).toBe(true)
    expect(await notesRepo.getNote(note.id)).toMatchObject({
      encrypted: 0,
      body: 'travels #x',
      tags: ['x'],
    })
    expect((await notesRepo.getNote(inParent.id))!.encrypted).toBe(1)
  })

  it('refuses a move that needs a locked key, and changes nothing', async () => {
    const { parent } = await tree()
    await encryptFolder(parent.id, PASS)
    const moving = await foldersRepo.createFolder({ name: 'Moving' })
    const note = await notesRepo.createNote({ folderId: moving.id, body: 'stays put' })
    keyring.lock(parent.id)

    await expect(moveFolderWithNotes(moving.id, parent.id, null, null)).rejects.toBeInstanceOf(
      FolderLockedError,
    )
    expect((await db.folders.get(moving.id))!.parentId).toBe(ROOT)
    expect(await notesRepo.getNote(note.id)).toMatchObject({ encrypted: 0, body: 'stays put' })
  })

  it('still refuses to drop a folder into its own subtree', async () => {
    const { parent, child } = await tree()
    expect(await moveFolderWithNotes(parent.id, child.id, null, null)).toBe(false)
  })
})
