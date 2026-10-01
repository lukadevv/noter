/**
 * Which encrypted folder guards a folder.
 *
 * An encrypted folder protects everything under it: a subfolder has no key of
 * its own, it uses the key of its nearest encrypted ancestor (its "lock root").
 * A subfolder that was itself encrypted with its own passphrase keeps that key,
 * so it is its own root. Pure functions over the folder list, so the rule is
 * tested directly and shared by the keyring, the notes store and the UI.
 */
import { ROOT, type Folder, type Note } from '$lib/db/schema'

export type LockFolder = Pick<Folder, 'id' | 'parentId' | 'encrypted' | 'kdf'>

/** Folder id to the id of the encrypted folder whose key protects it. Plain folders are absent. */
export type LockRoots = Map<string, string>

/** Whether a folder carries a key of its own. */
export const ownsKey = (folder: LockFolder): boolean => folder.encrypted === 1 && folder.kdf !== null

/** The lock root of every protected folder. A folder outside every encrypted tree is not in the map. */
export function lockRoots(folders: LockFolder[]): LockRoots {
  const byId = new Map(folders.map((f) => [f.id, f]))
  const roots: LockRoots = new Map()
  const resolved = new Map<string, string | null>()

  const resolve = (id: string): string | null => {
    const known = resolved.get(id)
    if (known !== undefined) return known
    // Mark first, so a corrupt parent cycle ends instead of recursing forever.
    resolved.set(id, null)
    const folder = byId.get(id)
    let root: string | null = null
    if (folder) {
      if (ownsKey(folder)) root = folder.id
      else if (folder.parentId !== ROOT) root = resolve(folder.parentId)
    }
    resolved.set(id, root)
    return root
  }

  for (const folder of folders) {
    const root = resolve(folder.id)
    if (root) roots.set(folder.id, root)
  }
  return roots
}

/** The lock root of one folder, or null when nothing above it is encrypted. */
export function lockRootOf(folders: LockFolder[], folderId: string): string | null {
  return lockRoots(folders).get(folderId) ?? null
}

/**
 * A note that sits in a protected folder but is still stored as plaintext: it
 * predates the folder's encryption (a subfolder created before subfolders
 * inherited the lock). It is hidden like a locked note and sealed the next time
 * its root is unlocked.
 */
export function isPending(note: Pick<Note, 'encrypted' | 'folderId'>, roots: LockRoots): boolean {
  return !note.encrypted && roots.has(note.folderId)
}

/**
 * A copy of a pending note with nothing readable left in it, shaped like a
 * locked one, so every list, index and count treats it as ciphertext.
 */
export function hidden<T extends Note>(note: T): T {
  return { ...note, encrypted: 1, title: '', body: '', tags: [] }
}

/** The folder list as it would be after `id` moves under `parentId`. */
export function withParent<T extends LockFolder>(folders: T[], id: string, parentId: string): T[] {
  return folders.map((f) => (f.id === id ? { ...f, parentId } : f))
}
