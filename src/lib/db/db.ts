import Dexie, { type Table } from 'dexie'
import { migrateBodyForView, needsMigration } from '$lib/md/migrate'
import { dayKey } from '$lib/utils/dates'
import type {
  FocusSession,
  Habit,
  HabitCheck,
  Stopwatch,
  ActivityDay,
  Asset,
  Dose,
  Folder,
  Med,
  Note,
  RunningTimer,
  SecretItem,
  SecretsMeta,
  Setting,
  SmartFolder,
  Sound,
  Theme,
  TimerPreset,
  Version,
} from './schema'

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
  timerPresets!: Table<TimerPreset, string>
  timers!: Table<RunningTimer, string>
  sounds!: Table<Sound, string>
  meds!: Table<Med, string>
  doses!: Table<Dose, string>
  secretItems!: Table<SecretItem, string>
  secretsMeta!: Table<SecretsMeta, string>
  activity!: Table<ActivityDay, string>
  focusSessions!: Table<FocusSession, string>
  stopwatch!: Table<Stopwatch, string>
  habits!: Table<Habit, string>
  habitChecks!: Table<HabitCheck, string>

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

    // v2: notes are built from blocks instead of choosing one view. Plaintext
    // notes (and their history) are rewritten here; encrypted ones cannot be
    // read, so they keep their `view` and are converted when next revealed.
    // `updatedAt` is left alone: this is not the user editing anything.
    this.version(2)
      .stores({})
      .upgrade(async (tx) => {
        const views = new Map<string, { view: Note['view']; lang: string | null }>()
        await tx
          .table<Note, string>('notes')
          .toCollection()
          .modify((note) => {
            if (!needsMigration(note)) {
              if (note.view === 'checklist' && !note.encrypted) note.view = 'doc'
              return
            }
            views.set(note.id, { view: note.view, lang: note.lang })
            if (note.encrypted) return
            note.body = migrateBodyForView(note.view, note.body, note.lang)
            note.view = 'doc'
          })
        await tx
          .table<Version, string>('versions')
          .toCollection()
          .modify((version) => {
            const source = views.get(version.noteId)
            if (!source || version.body.startsWith('noter:enc:')) return
            version.body = migrateBodyForView(source.view, version.body, source.lang)
          })
      })

    // v3: timers, their presets and custom alarm sounds.
    this.version(3).stores({
      timerPresets: 'id, order',
      timers: 'id, endAt, firedAt',
      sounds: 'id',
    })

    // v4: medication and the log of doses taken.
    this.version(4).stores({
      meds: 'id, order',
      doses: 'id, medId, takenAt, [medId+takenAt]',
    })

    // v5: the vault - encrypted secrets and the wrapped key that opens them.
    this.version(5).stores({
      secretItems: 'id, order',
      secretsMeta: 'id',
    })

    // v6: daily activity counters for Home. Seeded from what the notes already
    // say (when each was created and last edited), so the chart is not empty
    // on the first day.
    this.version(6)
      .stores({ activity: 'day' })
      .upgrade(async (tx) => {
        const days = new Map<string, ActivityDay>()
        const row = (day: string) => {
          let entry = days.get(day)
          if (!entry) {
            entry = { day, edits: 0, created: 0, words: 0, updatedAt: Date.now() }
            days.set(day, entry)
          }
          return entry
        }
        await tx.table<Note, string>('notes').each((note) => {
          if (note.deletedAt > 0 || note.system) return
          row(dayKey(new Date(note.createdAt))).created++
          row(dayKey(new Date(note.updatedAt))).edits++
        })
        await tx.table<ActivityDay, string>('activity').bulkPut([...days.values()])
      })

    // v7: pomodoro focus log, the stopwatch, and habits with their daily checks.
    this.version(7).stores({
      focusSessions: 'id, day',
      stopwatch: 'id',
      habits: 'id, order',
      habitChecks: 'id, habitId, day, [habitId+day]',
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
