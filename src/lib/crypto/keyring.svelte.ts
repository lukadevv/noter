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
import type { Folder, Note } from '$lib/db/schema'
import { updateNote } from '$lib/db/repo/notes'
import { descendantIds, isAncestor, moveFolder, updateFolder } from '$lib/db/repo/folders'
import { ROOT } from '$lib/db/schema'
import { lockRoots, withParent, type LockRoots } from './lock-root'
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
 *
 * A key belongs to an encrypted folder (its "lock root") and also protects every
 * folder beneath it, so a lookup by any folder id resolves to its root first.
 */
class Keyring {
  /** Lock root id to derived key. Never serialised, never logged. */
  #keys = new Map<string, CryptoKey>()
  #timers = new Map<string, ReturnType<typeof setTimeout>>()
  #sweeps = new Map<string, Promise<number>>()
  /** Lock roots being decrypted: sealing the notes as they are opened would undo it. */
  #opening = new Set<string>()

  /** Ids of currently unlocked lock roots, for the UI. */
  unlocked = $state<string[]>([])

  /** Folder id to the encrypted folder that guards it, kept in step with the folder list. */
  roots = $state.raw<LockRoots>(new Map())

  /** Feeds the folder list in, so lookups by folder id can find the lock root. */
  sync(folders: Pick<Folder, 'id' | 'parentId' | 'encrypted' | 'kdf'>[]): void {
    const next = lockRoots(folders)
    // The same answer is not news: it would re-run everything that reads it.
    const same =
      next.size === this.roots.size && [...next].every(([id, root]) => this.roots.get(id) === root)
    if (!same) this.roots = next
  }

  /** Re-reads the folders from the database, for code that has just changed them. */
  async refresh(): Promise<void> {
    this.sync(await db.folders.toArray())
  }

  /** The encrypted folder whose key protects this folder, or null when it is not protected. */
  rootOf(folderId: string): string | null {
    return this.roots.get(folderId) ?? null
  }

  /** Whether the folder is, or is inside, an encrypted folder. */
  isProtected(folderId: string): boolean {
    return this.roots.has(folderId)
  }

  isUnlocked(folderId: string): boolean {
    return this.unlocked.includes(this.rootOf(folderId) ?? folderId)
  }

  keyFor(folderId: string): CryptoKey | null {
    return this.#keys.get(this.rootOf(folderId) ?? folderId) ?? null
  }

  /** The key of a lock root itself. */
  keyOfRoot(rootId: string): CryptoKey | null {
    return this.#keys.get(rootId) ?? null
  }

  #arm(rootId: string): void {
    const existing = this.#timers.get(rootId)
    if (existing) clearTimeout(existing)
    this.#timers.set(
      rootId,
      setTimeout(() => this.lock(rootId), IDLE_TIMEOUT_MS),
    )
  }

  /** Called on user activity so an in-use folder does not lock underneath them. */
  touch(folderId: string): void {
    const root = this.rootOf(folderId) ?? folderId
    if (this.#keys.has(root)) this.#arm(root)
  }

  /** Keeps a key that was just derived, so it is not derived twice. */
  adopt(rootId: string, key: CryptoKey): void {
    this.#keys.set(rootId, key)
    if (!this.unlocked.includes(rootId)) this.unlocked = [...this.unlocked, rootId]
    this.#arm(rootId)
  }

  /**
   * Unlocks the encrypted folder that guards `folderId` (which may be a
   * subfolder). Notes that were stored in the clear inside it are sealed now.
   */
  async unlock(folderId: string, passphrase: string): Promise<boolean> {
    const rootId = this.rootOf(folderId) ?? folderId
    const folder = await db.folders.get(rootId)
    if (!folder?.kdf || !folder.verifier) return false

    const key = await deriveKey(passphrase, folder.kdf)
    if (!(await checkVerifier(key, folder.verifier))) return false

    this.adopt(rootId, key)
    await this.sealPending(rootId)
    return true
  }

  /**
   * Seals every note in the lock root's tree that is still plaintext: the ones
   * a subfolder held before subfolders inherited the lock, or that landed there
   * through an import. Runs once per unlock and whenever such a note shows up.
   * Returns how many notes were sealed.
   */
  sealPending(rootId: string): Promise<number> {
    if (this.#opening.has(rootId)) return Promise.resolve(0)
    const running = this.#sweeps.get(rootId)
    if (running) return running
    const sweep = sealPendingNotes(rootId).finally(() => this.#sweeps.delete(rootId))
    this.#sweeps.set(rootId, sweep)
    return sweep
  }

  /** Holds back `sealPending` for a root while its notes are being decrypted. */
  holdSealing(rootId: string, on: boolean): void {
    if (on) this.#opening.add(rootId)
    else this.#opening.delete(rootId)
  }

  /** Locks the encrypted folder that guards `folderId`, and with it everything under it. */
  lock(folderId: string): void {
    const rootId = this.rootOf(folderId) ?? folderId
    this.#keys.delete(rootId)
    const timer = this.#timers.get(rootId)
    if (timer) clearTimeout(timer)
    this.#timers.delete(rootId)
    this.unlocked = this.unlocked.filter((id) => id !== rootId)
  }

  lockAll(): void {
    for (const id of [...this.#keys.keys()]) this.lock(id)
  }
}

export const keyring = new Keyring()

/**
 * Encrypts a folder: every note inside it and in the folders beneath it is
 * rewritten as ciphertext, and the plaintext tags are cleared so a locked note
 * leaks nothing through the index. Subfolders need no passphrase of their own;
 * they are guarded by this one.
 */
export async function encryptFolder(folderId: string, passphrase: string): Promise<number> {
  const kdf = newKdfParams()
  const key = await deriveKey(passphrase, kdf)
  const verifier = await makeVerifier(key)

  // The flag goes first: from here the notes still in the clear count as
  // waiting for their key and are hidden, so an interruption leaves nothing
  // readable behind. They are sealed below, or at the next unlock.
  await updateFolder(folderId, { encrypted: 1, kdf, verifier })
  await keyring.refresh()
  keyring.adopt(folderId, key)
  return keyring.sealPending(folderId)
}

/** Ids of the folders a lock root guards, itself included. */
function guardedBy(roots: LockRoots, rootId: string): string[] {
  return [...roots].filter(([, root]) => root === rootId).map(([id]) => id)
}

/** Seals the notes under `rootId` that are still plaintext. Use `keyring.sealPending`. */
async function sealPendingNotes(rootId: string): Promise<number> {
  const key = keyring.keyOfRoot(rootId)
  if (!key) return 0
  const roots = lockRoots(await db.folders.toArray())
  const ids = guardedBy(roots, rootId)
  const notes = await db.notes.where('folderId').anyOf(ids).toArray()

  let sealed = 0
  for (const note of notes) {
    if (note.encrypted) continue
    // Not an edit by the user, so `updatedAt` stays as it was.
    await db.notes.update(note.id, {
      title: packEnvelope(await encryptText(key, note.title)),
      body: packEnvelope(await encryptText(key, note.body)),
      tags: [],
      assetRefs: referencedAssetIds(note.body),
      encrypted: 1,
    })
    await sealVersions(key, note.id)
    sealed++
  }
  return sealed
}

/**
 * Removes encryption from a folder, restoring plaintext notes - those in the
 * folder and in the subfolders that relied on its key. A subfolder that was
 * encrypted with a passphrase of its own stays encrypted.
 */
export async function decryptFolder(folderId: string): Promise<number> {
  const key = keyring.keyFor(folderId)
  if (!key) throw new Error('Unlock the folder first')

  const roots = lockRoots(await db.folders.toArray())
  const notes = await db.notes.where('folderId').anyOf(guardedBy(roots, folderId)).toArray()
  // Until the folder itself is plain, a note opened here is "in the clear inside
  // an encrypted folder" - which the store would seal again straight away.
  keyring.holdSealing(folderId, true)
  try {
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
    await keyring.refresh()
  } finally {
    keyring.holdSealing(folderId, false)
  }
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

/** A note's new ciphertext (or plaintext) and its history's, worked out before anything is written. */
export interface RecryptPlan {
  noteId: string
  patch: Partial<Note>
  versions: { id: string; title: string; body: string }[]
}

/**
 * Re-encrypts one note from `from` (its current key, null when it is plaintext)
 * to `to` (the key of where it is going, null for a plain folder). Returns null
 * when nothing changes. All the crypto happens here, so a caller can finish it
 * for every note before writing any of them.
 */
async function planRecrypt(
  note: Note,
  from: CryptoKey | null,
  to: CryptoKey | null,
): Promise<RecryptPlan | null> {
  if (note.encrypted && !from) throw new FolderLockedError(note.folderId)
  if (!note.encrypted && !to) return null
  if (note.encrypted && from === to) return null

  const plain = from
    ? { title: await revealText(from, note.title), body: await revealText(from, note.body) }
    : { title: note.title, body: note.body }

  const patch: Partial<Note> = to
    ? {
        title: packEnvelope(await encryptText(to, plain.title)),
        body: packEnvelope(await encryptText(to, plain.body)),
        tags: [],
        assetRefs: referencedAssetIds(plain.body),
        encrypted: 1,
      }
    : { ...plain, tags: extractTags(plain.body), assetRefs: undefined, encrypted: 0 }

  // History follows the note: a snapshot left under the old key is unreadable in
  // the new home, and one left in the clear inside a locked folder defeats it.
  const versions: RecryptPlan['versions'] = []
  for (const version of await db.versions.where('noteId').equals(note.id).toArray()) {
    const sealed = isEncrypted(version.body)
    if (sealed && !from) continue
    const title = sealed ? await revealText(from!, version.title) : version.title
    const body = sealed ? await revealText(from!, version.body) : version.body
    versions.push({
      id: version.id,
      title: to ? packEnvelope(await encryptText(to, title)) : title,
      body: to ? packEnvelope(await encryptText(to, body)) : body,
    })
  }
  return { noteId: note.id, patch, versions }
}

async function writeVersions(plans: RecryptPlan[]): Promise<void> {
  for (const plan of plans) {
    for (const version of plan.versions) {
      await db.versions.update(version.id, { title: version.title, body: version.body })
    }
  }
}

/** The key a lock root needs to be used, or a `FolderLockedError` naming it. */
function requireKey(rootId: string): CryptoKey {
  const key = keyring.keyOfRoot(rootId)
  if (!key) throw new FolderLockedError(rootId)
  return key
}

/**
 * Works out how a note must be re-encrypted to live in another folder, or
 * returns null when nothing changes.
 *
 * Each lock root has its own key, so a note moved between them has to be
 * decrypted with the old key and sealed with the new one - otherwise it becomes
 * unreadable in its new home, or stays plaintext inside a locked one. Moving
 * within one encrypted tree changes nothing.
 */
export async function planNoteMove(note: Note, targetFolderId: string): Promise<RecryptPlan | null> {
  await keyring.refresh()
  const toRoot = keyring.rootOf(targetFolderId)
  const to = toRoot ? requireKey(toRoot) : null
  const from = note.encrypted ? requireKey(keyring.rootOf(note.folderId) ?? note.folderId) : null
  return planRecrypt(note, from, to)
}

/** Writes a planned move: the note's own patch is applied by the caller, its history here. */
export async function finishNoteMove(plan: RecryptPlan | null): Promise<void> {
  if (plan) await writeVersions([plan])
}

/**
 * Moves a folder, re-encrypting the notes whose lock root changes with it.
 *
 * Moving a folder into an encrypted one seals everything in it with that key;
 * moving it out opens everything it relied on. Either way the keys involved
 * must be unlocked, and are checked before anything is written. The folder and
 * its notes change in one transaction, so a move never leaves notes sealed for
 * a place they are not in. Returns false for a move into the folder's own subtree.
 */
export async function moveFolderWithNotes(
  id: string,
  parentId: string,
  before: string | null,
  after: string | null,
): Promise<boolean> {
  const folders = await db.folders.toArray()
  if (parentId !== ROOT && isAncestor(folders, id, parentId)) return false

  const roots = lockRoots(folders)
  const afterRoots = lockRoots(withParent(folders, id, parentId))
  const notes = await db.notes
    .where('folderId')
    .anyOf(await descendantIds(id))
    .toArray()

  const plans: RecryptPlan[] = []
  for (const note of notes) {
    const fromRoot = roots.get(note.folderId) ?? null
    const toRoot = afterRoots.get(note.folderId) ?? null
    if (fromRoot === toRoot) continue
    const from = note.encrypted ? requireKey(fromRoot ?? note.folderId) : null
    const to = toRoot ? requireKey(toRoot) : null
    const plan = await planRecrypt(note, from, to)
    if (plan) plans.push(plan)
  }

  let moved = false
  await db.transaction('rw', db.folders, db.notes, async () => {
    moved = await moveFolder(id, parentId, before, after)
    if (!moved) return
    for (const plan of plans) await db.notes.update(plan.noteId, plan.patch)
  })
  if (moved) {
    await writeVersions(plans)
    await keyring.refresh()
  }
  return moved
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
  // A locked-looking note with no ciphertext is a stand-in for one still in the
  // clear (see `hidden`): there is nothing to open until it has been sealed.
  if (!key || !isEncrypted(note.body)) return null
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
