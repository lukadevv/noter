import { beforeEach, describe, expect, it } from 'vitest'
import { useFreshDb } from './helpers/fresh-db'
import { db } from '$lib/db/db'
import * as notesRepo from '$lib/db/repo/notes'
import * as foldersRepo from '$lib/db/repo/folders'
import { purgeOrphanAssets } from '$lib/db/repo/assets'
import {
  FolderLockedError,
  encryptFolder,
  keyring,
  recryptForFolder,
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

    const inPatch = await recryptForFolder(note, secret.id)
    expect(inPatch?.encrypted).toBe(1)
    expect(isEncrypted(inPatch!.body!)).toBe(true)
    await notesRepo.moveNote(note.id, secret.id, null, null, inPatch!)

    const moved = (await notesRepo.getNote(note.id))!
    expect((await revealNote(moved))?.body).toBe('hello #tag')

    const outPatch = await recryptForFolder(moved, plain.id)
    expect(outPatch).toMatchObject({ body: 'hello #tag', encrypted: 0, tags: ['tag'] })

    keyring.lock(secret.id)
    await expect(recryptForFolder(moved, plain.id)).rejects.toBeInstanceOf(FolderLockedError)
  })
})
