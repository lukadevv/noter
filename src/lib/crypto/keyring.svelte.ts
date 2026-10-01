import { db } from '$lib/db/db'
import {
  checkVerifier,
  deriveKey,
  decryptText,
  encryptText,
  isEncrypted,
  makeVerifier,
  newKdfParams,
  packEnvelope,
  unpackEnvelope,
} from './vault'
import type { Note } from '$lib/db/schema'
import { updateNote } from '$lib/db/repo/notes'
import { updateFolder } from '$lib/db/repo/folders'
import { extractTags } from '$lib/md/links'
import { referencedAssetIds } from '$lib/db/repo/assets'
import { migrateBodyForView, needsMigration } from '$lib/md/migrate'

/** Locked folders re-lock after this long without activity. */
const IDLE_TIMEOUT_MS = 15 * 60_000

/**
 * Holds the derived keys of unlocked folders - in memory only.
 *
 * Nothing here is ever persisted: keys die with the tab, and an idle timer
 * discards them sooner. That is the whole security value of the feature; a key
 * written to IndexedDB next to the ciphertext would protect nothing.
 */
class Keyring {
  /** Folder id to derived key. Never serialised, never logged. */
  #keys = new Map<string, CryptoKey>()
  #timers = new Map<string, ReturnType<typeof setTimeout>>()

  /** Ids of currently unlocked folders, for the UI. */
  unlocked = $state<string[]>([])

  isUnlocked(folderId: string): boolean {
    return this.#keys.has(folderId)
  }

  keyFor(folderId: string): CryptoKey | null {
    return this.#keys.get(folderId) ?? null
  }

  #arm(folderId: string): void {
    const existing = this.#timers.get(folderId)
    if (existing) clearTimeout(existing)
    this.#timers.set(
      folderId,
      setTimeout(() => this.lock(folderId), IDLE_TIMEOUT_MS),
    )
  }

  /** Called on user activity so an in-use folder does not lock underneath them. */
  touch(folderId: string): void {
    if (this.#keys.has(folderId)) this.#arm(folderId)
  }

  async unlock(folderId: string, passphrase: string): Promise<boolean> {
    const folder = await db.folders.get(folderId)
    if (!folder?.kdf || !folder.verifier) return false

    const key = await deriveKey(passphrase, folder.kdf)
    if (!(await checkVerifier(key, folder.verifier))) return false

    this.#keys.set(folderId, key)
    this.unlocked = [...this.unlocked, folderId]
    this.#arm(folderId)
    return true
  }

  lock(folderId: string): void {
    this.#keys.delete(folderId)
    const timer = this.#timers.get(folderId)
    if (timer) clearTimeout(timer)
    this.#timers.delete(folderId)
    this.unlocked = this.unlocked.filter((id) => id !== folderId)
  }

  lockAll(): void {
    for (const id of [...this.#keys.keys()]) this.lock(id)
  }
}

export const keyring = new Keyring()

/**
 * Encrypts a folder: every note inside is rewritten as ciphertext, and the
 * plaintext tags are cleared so a locked note leaks nothing through the index.
 */
export async function encryptFolder(folderId: string, passphrase: string): Promise<number> {
  const kdf = newKdfParams()
  const key = await deriveKey(passphrase, kdf)
  const verifier = await makeVerifier(key)

  const notes = await db.notes.where('folderId').equals(folderId).toArray()
  for (const note of notes) {
    if (note.encrypted) continue
    await updateNote(note.id, {
      title: packEnvelope(await encryptText(key, note.title)),
      body: packEnvelope(await encryptText(key, note.body)),
      tags: [],
      assetRefs: referencedAssetIds(note.body),
      encrypted: 1,
    })
    await sealVersions(key, note.id)
  }

  await updateFolder(folderId, { encrypted: 1, kdf, verifier })
  keyring.lock(folderId)
  await keyring.unlock(folderId, passphrase)
  return notes.length
}

/** Removes encryption from a folder, restoring plaintext notes. */
export async function decryptFolder(folderId: string): Promise<number> {
  const key = keyring.keyFor(folderId)
  if (!key) throw new Error('Unlock the folder first')

  const notes = await db.notes.where('folderId').equals(folderId).toArray()
  for (const note of notes) {
    if (!note.encrypted) continue
    const title = await revealText(key, note.title)
    // A note encrypted before blocks existed is converted now that it can be read.
    const body = migrateBodyForView(note.view, await revealText(key, note.body), note.lang)
    await updateNote(note.id, {
      title,
      body,
      tags: extractTags(body),
      assetRefs: undefined,
      encrypted: 0,
      view: 'doc',
    })
    await openVersions(key, note.id)
  }

  await updateFolder(folderId, { encrypted: 0, kdf: null, verifier: null })
  keyring.lock(folderId)
  return notes.length
}

async function revealText(key: CryptoKey, value: string): Promise<string> {
  const envelope = unpackEnvelope(value)
  return envelope ? decryptText(key, envelope) : value
}

/**
 * Encrypts a note's history along with the note. Snapshots taken before the
 * folder was locked are plaintext copies of the same text, so leaving them
 * would defeat the encryption entirely.
 */
async function sealVersions(key: CryptoKey, noteId: string): Promise<void> {
  const versions = await db.versions.where('noteId').equals(noteId).toArray()
  for (const version of versions) {
    if (isEncrypted(version.body)) continue
    await db.versions.update(version.id, {
      title: packEnvelope(await encryptText(key, version.title)),
      body: packEnvelope(await encryptText(key, version.body)),
    })
  }
}

async function openVersions(key: CryptoKey, noteId: string): Promise<void> {
  const versions = await db.versions.where('noteId').equals(noteId).toArray()
  for (const version of versions) {
    await db.versions.update(version.id, {
      title: await revealText(key, version.title),
      body: await revealText(key, version.body),
    })
  }
}

/**
 * Decrypts any value that belongs to a folder - a snapshot, a template body.
 * Plaintext passes through untouched; null means the folder is locked.
 */
export async function revealInFolder(folderId: string, value: string): Promise<string | null> {
  if (!isEncrypted(value)) return value
  const key = keyring.keyFor(folderId)
  if (!key) return null
  try {
    return await revealText(key, value)
  } catch {
    return null
  }
}

/** Why a note could not be moved: the folder whose key is missing. */
export class FolderLockedError extends Error {
  constructor(public folderId: string) {
    super('Unlock the folder first')
  }
}

/**
 * Re-encrypts a note for a new folder, or returns null when nothing changes.
 *
 * Each encrypted folder has its own key, so a note moved between folders has
 * to be decrypted with the old key and sealed with the new one - otherwise it
 * becomes unreadable in its new home, or stays plaintext inside a locked one.
 */
export async function recryptForFolder(note: Note, targetFolderId: string): Promise<Partial<Note> | null> {
  if (note.folderId === targetFolderId) return null
  const target = targetFolderId ? await db.folders.get(targetFolderId) : undefined
  const targetEncrypted = target?.encrypted === 1
  if (!note.encrypted && !targetEncrypted) return null

  let plain = { title: note.title, body: note.body }
  if (note.encrypted) {
    const key = keyring.keyFor(note.folderId)
    if (!key) throw new FolderLockedError(note.folderId)
    plain = { title: await revealText(key, note.title), body: await revealText(key, note.body) }
  }

  if (!targetEncrypted) {
    return { ...plain, tags: extractTags(plain.body), assetRefs: undefined, encrypted: 0 }
  }
  const sealed = await sealNote(targetFolderId, plain.title, plain.body)
  if (!sealed) throw new FolderLockedError(targetFolderId)
  return { ...sealed, tags: [], encrypted: 1 }
}

/**
 * Decrypts a note for display, when its folder is unlocked.
 *
 * An encrypted note written before blocks existed could not be converted by
 * the database upgrade (it was ciphertext); it is converted here, the first
 * time it is readable, and written back sealed.
 */
export async function revealNote(note: Note): Promise<{ title: string; body: string } | null> {
  if (!note.encrypted) return { title: note.title, body: note.body }
  const key = keyring.keyFor(note.folderId)
  if (!key) return null
  let plain: { title: string; body: string }
  try {
    plain = { title: await revealText(key, note.title), body: await revealText(key, note.body) }
  } catch {
    return null
  }
  if (needsMigration(note)) {
    plain = { ...plain, body: migrateBodyForView(note.view, plain.body, note.lang) }
    const sealed = await sealNote(note.folderId, plain.title, plain.body)
    // Not an edit by the user, so `updatedAt` stays as it was.
    if (sealed) await db.notes.update(note.id, { ...sealed, view: 'doc' })
  }
  return plain
}

/** Re-encrypts an edited note before it is written back. */
export async function sealNote(
  folderId: string,
  title: string,
  body: string,
): Promise<{ title: string; body: string; assetRefs: string[] } | null> {
  const key = keyring.keyFor(folderId)
  if (!key) return null
  return {
    title: packEnvelope(await encryptText(key, title)),
    body: packEnvelope(await encryptText(key, body)),
    assetRefs: referencedAssetIds(body),
  }
}

export { isEncrypted }
