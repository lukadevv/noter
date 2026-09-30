import { db } from '$lib/db/db'
import { exportVault, vaultFileName } from './vault-file'
import { archiveFileName, exportMarkdownArchive } from './archive'

/**
 * Automatic backups to a real folder on disk.
 *
 * IndexedDB is not a safe home for the only copy of anything: browsers evict it
 * under storage pressure, and Safari clears it after seven days without a visit.
 * The File System Access API lets the user grant a folder once — the handle is
 * stored and survives restarts — after which backups are written without any
 * further prompting.
 *
 * Firefox and Safari do not implement it. There the app falls back to manual
 * downloads and nags when the last backup gets old.
 */

const HANDLE_KEY = 'backup.directory'
const STATE_KEY = 'backup.state'

export type BackupFrequency = 'off' | 'manual' | 'daily' | 'weekly'

export interface BackupState {
  frequency: BackupFrequency
  lastRunAt: number
  lastError: string | null
  /** Encrypt the vault file written to disk. */
  encrypt: boolean
}

export const DEFAULT_BACKUP_STATE: BackupState = {
  frequency: 'off',
  lastRunAt: 0,
  lastError: null,
  encrypt: false,
}

export function supportsDirectoryAccess(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export async function loadBackupState(): Promise<BackupState> {
  const row = await db.settings.get(STATE_KEY)
  return { ...DEFAULT_BACKUP_STATE, ...((row?.value as Partial<BackupState>) ?? {}) }
}

export async function saveBackupState(state: BackupState): Promise<void> {
  await db.settings.put({ key: STATE_KEY, value: state })
}

async function storedHandle(): Promise<FileSystemDirectoryHandle | null> {
  const row = await db.settings.get(HANDLE_KEY)
  return (row?.value as FileSystemDirectoryHandle | undefined) ?? null
}

/** Asks for a folder and remembers it. Returns its name, or null if cancelled. */
export async function chooseDirectory(): Promise<string | null> {
  if (!supportsDirectoryAccess()) return null
  try {
    const handle = await window.showDirectoryPicker({ id: 'noter-backups', mode: 'readwrite' })
    await db.settings.put({ key: HANDLE_KEY, value: handle })
    return handle.name
  } catch {
    // The picker throws on cancel; that is not an error worth reporting.
    return null
  }
}

export async function forgetDirectory(): Promise<void> {
  await db.settings.delete(HANDLE_KEY)
}

export async function directoryName(): Promise<string | null> {
  return (await storedHandle())?.name ?? null
}

/**
 * Re-checks permission on a stored handle. Browsers drop the grant between
 * sessions, and re-requesting it needs a user gesture, so callers must invoke
 * this from a click.
 */
export async function ensurePermission(): Promise<boolean> {
  const handle = await storedHandle()
  if (!handle) return false

  const options = { mode: 'readwrite' } as FileSystemHandlePermissionDescriptor
  if ((await handle.queryPermission(options)) === 'granted') return true
  return (await handle.requestPermission(options)) === 'granted'
}

async function writeFile(handle: FileSystemDirectoryHandle, name: string, blob: Blob): Promise<void> {
  const file = await handle.getFileHandle(name, { create: true })
  const stream = await file.createWritable()
  await stream.write(blob)
  await stream.close()
}

export interface BackupRun {
  ok: boolean
  files: string[]
  error?: string
  /** Encryption is on but no passphrase was given, so the vault file was not written. */
  vaultSkipped?: boolean
}

/**
 * Writes a vault file and a markdown archive into the chosen folder.
 *
 * Both formats are written every time on purpose: the vault restores exactly,
 * the markdown archive stays readable if this app is ever gone.
 */
export async function runBackup(passphrase?: string): Promise<BackupRun> {
  const handle = await storedHandle()
  if (!handle) return { ok: false, files: [], error: 'No backup folder has been chosen.' }

  const options = { mode: 'readwrite' } as FileSystemHandlePermissionDescriptor
  if ((await handle.queryPermission(options)) !== 'granted') {
    return { ok: false, files: [], error: 'Permission to the backup folder has lapsed.' }
  }

  try {
    const vaultName = vaultFileName()
    const archiveName = archiveFileName()
    const state = await loadBackupState()
    // Passphrases are never stored, so an unattended run cannot encrypt. Writing
    // the vault in plaintext would silently break the promise the setting makes;
    // skipping it and saying so is the honest option.
    const vaultSkipped = state.encrypt && !passphrase
    if (!vaultSkipped) {
      await writeFile(handle, vaultName, await exportVault(passphrase ? { passphrase } : {}))
    }
    await writeFile(handle, archiveName, await exportMarkdownArchive())

    await saveBackupState({ ...state, lastRunAt: Date.now(), lastError: null })
    return { ok: true, files: vaultSkipped ? [archiveName] : [vaultName, archiveName], vaultSkipped }
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : 'The backup could not be written.'
    const state = await loadBackupState()
    await saveBackupState({ ...state, lastError: error })
    return { ok: false, files: [], error }
  }
}

const DAY_MS = 86_400_000

/** True when the configured schedule says a backup is overdue. */
export function isDue(state: BackupState, now = Date.now()): boolean {
  if (state.frequency === 'off' || state.frequency === 'manual') return false
  const interval = state.frequency === 'daily' ? DAY_MS : 7 * DAY_MS
  return now - state.lastRunAt >= interval
}

/** How stale the last backup is, for the reminder shown to fallback browsers. */
export function daysSinceBackup(state: BackupState, now = Date.now()): number | null {
  if (state.lastRunAt === 0) return null
  return Math.floor((now - state.lastRunAt) / DAY_MS)
}
