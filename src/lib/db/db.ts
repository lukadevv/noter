import Dexie, { type Table } from 'dexie'
import type { Asset, Folder, Note, Setting, SmartFolder, Theme, Version } from './schema'

/**
 * Schema versions are append-only: never edit a past `.version()` block, add a
 * new one. Dexie replays them in order for users on older stores.
 */
export class NoterDB extends Dexie {
  notes!: Table<Note, string>
  folders!: Table<Folder, string>
  assets!: Table<Asset, string>
  versions!: Table<Version, string>
  smartFolders!: Table<SmartFolder, string>
  themes!: Table<Theme, string>
  settings!: Table<Setting, string>

  constructor(name = 'noter') {
    super(name)

    this.version(1).stores({
      notes:
        'id, folderId, updatedAt, createdAt, deletedAt, archivedAt, pinned, daily, system, template, ' +
        '[folderId+deletedAt], [deletedAt+archivedAt], [folderId+order], *tags',
      folders: 'id, parentId, order, updatedAt, [parentId+order]',
      assets: 'id, hash, createdAt',
      versions: 'id, noteId, createdAt, [noteId+createdAt]',
      smartFolders: 'id, order',
      themes: 'id, name',
      settings: 'key',
    })
  }
}

export const db = new NoterDB()

/**
 * Asks the browser to exempt our data from automatic eviction. Chrome grants it
 * silently for installed/engaged sites; Safari never does, which is exactly why
 * the app pushes disk backups. Returns the resulting persistence state.
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export interface StorageEstimateInfo {
  usage: number
  quota: number
  persisted: boolean
  supported: boolean
}

export async function storageInfo(): Promise<StorageEstimateInfo> {
  if (!navigator.storage?.estimate) {
    return { usage: 0, quota: 0, persisted: false, supported: false }
  }
  const [estimate, persisted] = await Promise.all([
    navigator.storage.estimate(),
    navigator.storage.persisted?.() ?? Promise.resolve(false),
  ])
  return {
    usage: estimate.usage ?? 0,
    quota: estimate.quota ?? 0,
    persisted,
    supported: true,
  }
}
