/**
 * Demo data for the trailer.
 *
 * This module is served by the Vite dev server and imported inside the page
 * (`await import('/.trailer/app/seed.ts')`), so it runs against the app's own
 * modules: the same Dexie instance, the same vault and folder encryption. A
 * hand-written IndexedDB dump would drift from the schema; this cannot.
 *
 * Everything is placed relative to `Date.now()`, which the recorder pins with
 * Playwright's fake clock, so the "today" in the video is always the same day.
 */
import { db } from '$lib/db/db'
import { DEFAULT_SETTINGS, type AppSettings } from '$lib/db/repo/settings'
import { emptyNote } from '$lib/db/repo/notes'
import { createFolder } from '$lib/db/repo/folders'
import { encryptFolder } from '$lib/crypto/keyring.svelte'
import { createVault, sealItem } from '$lib/secrets/crypto'
import { KIND_FIELDS, type SecretData, type SecretKind } from '$lib/secrets/store.svelte'
import { extractTags } from '$lib/md/links'
import { addDays, dayKey } from '$lib/utils/dates'
import { uuid } from '$lib/utils/uuid'
import type { HabitSchedule, IconRef } from '$lib/db/schema'

export interface DemoFolder {
  key: string
  name: string
  icon?: IconRef
  color?: string | null
  /** Locked with `DemoData.folderPassphrase` once its notes are written. */
  encrypted?: boolean
}

export interface DemoNote {
  folder?: string
  title: string
  body: string
  pinned?: boolean
  /** How long ago it was last edited, which orders the note list. */
  hoursAgo?: number
}

export interface DemoHabit {
  name: string
  icon: string
  color: string
  target?: number
  schedule?: HabitSchedule
  /** Consecutive finished days up to yesterday. */
  streak: number
  /** Progress already made today. */
  todayCount?: number
}

export interface DemoMed {
  name: string
  dose: string
  color: string | null
  intervalHours: number
  /** When the last dose was taken; a value near `intervalHours` makes it due now. */
  lastTakenHoursAgo: number
  stock?: number | null
}

export interface DemoPreset {
  label: string
  minutes: number
  color: string | null
  soundId?: string
}

export interface DemoSecret {
  kind: SecretKind
  title: string
  favorite?: boolean
  fields: Record<string, string>
}

export interface DemoData {
  folders: DemoFolder[]
  notes: DemoNote[]
  habits: DemoHabit[]
  meds: DemoMed[]
  presets: DemoPreset[]
  vaultPassword: string
  secrets: DemoSecret[]
  folderPassphrase: string
}

/** Wipes every table so a second run never stacks data on the first. */
async function reset(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear()
  })
}

const HOUR = 3_600_000

export async function seed(data: DemoData, settings: Partial<AppSettings> = {}): Promise<void> {
  await reset()
  const now = Date.now()
  const today = dayKey()

  await db.settings.put({
    key: 'app',
    value: {
      ...DEFAULT_SETTINGS,
      tourDone: true,
      notifications: false,
      updates: { ...DEFAULT_SETTINGS.updates, autoCheck: false },
      dailyNotes: { ...DEFAULT_SETTINGS.dailyNotes, homeAlert: false },
      timers: { ...DEFAULT_SETTINGS.timers, seeded: true },
      pomodoro: { ...DEFAULT_SETTINGS.pomodoro, soundId: 'digital' },
      home: { ...DEFAULT_SETTINGS.home, dailyDismissed: today },
      // Last, so a language file can still override any of the above.
      ...settings,
    } satisfies AppSettings,
  })

  // Folders, in the order given.
  const folderIds = new Map<string, string>()
  for (const folder of data.folders) {
    const created = await createFolder({
      name: folder.name,
      icon: folder.icon,
      color: folder.color ?? null,
    })
    folderIds.set(folder.key, created.id)
  }

  // Notes. Written straight to the table so their timestamps can be backdated.
  for (const [index, note] of data.notes.entries()) {
    const ts = now - (note.hoursAgo ?? index * 5) * HOUR
    await db.notes.add({
      ...emptyNote({
        title: note.title,
        body: note.body,
        folderId: note.folder ? folderIds.get(note.folder) : undefined,
        tags: extractTags(note.body),
      }),
      pinned: note.pinned ? 1 : 0,
      order: (index + 1) * 1000,
      createdAt: ts - 48 * HOUR,
      updatedAt: ts,
    })
  }

  // Encrypt after the notes are in, exactly as a user would. Encrypting counts
  // as an edit, so the original timestamps are put back afterwards.
  for (const folder of data.folders) {
    if (!folder.encrypted) continue
    const folderId = folderIds.get(folder.key)!
    const before = await db.notes.where('folderId').equals(folderId).toArray()
    await encryptFolder(folderId, data.folderPassphrase)
    for (const note of before) await db.notes.update(note.id, { updatedAt: note.updatedAt })
  }

  // Habits with a history, so streaks and the week strip have something to show.
  for (const [index, habit] of data.habits.entries()) {
    const id = uuid()
    const target = habit.target ?? 1
    await db.habits.add({
      id,
      name: habit.name,
      icon: habit.icon,
      color: habit.color,
      schedule: habit.schedule ?? { kind: 'daily' },
      target,
      reminderTime: null,
      notifiedDay: '',
      archived: 0,
      order: (index + 1) * 1000,
      createdAt: now - 90 * 24 * HOUR,
      updatedAt: now,
    })
    const days = Array.from({ length: habit.streak }, (_, i) => addDays(today, -(i + 1)))
    if (habit.todayCount) days.push(today)
    await db.habitChecks.bulkAdd(
      days.map((day) => ({
        id: `${id}:${day}`,
        habitId: id,
        day,
        count: day === today ? habit.todayCount! : target,
        createdAt: now,
        updatedAt: now,
      })),
    )
  }

  // Medication, with a last dose placed so the next one is due when the video runs.
  for (const [index, med] of data.meds.entries()) {
    const id = uuid()
    await db.meds.add({
      id,
      name: med.name,
      dose: med.dose,
      color: med.color,
      intervalHours: med.intervalHours,
      leadMinutes: 30,
      notes: '',
      stock: med.stock ?? null,
      perDose: 1,
      active: 1,
      notifiedDue: 0,
      order: (index + 1) * 1000,
      createdAt: now - 60 * 24 * HOUR,
      updatedAt: now,
    })
    // A week of regular doses before the latest one, for the history strip.
    const doses = []
    for (let i = 0; i < Math.round((7 * 24) / med.intervalHours); i++) {
      const takenAt = now - (med.lastTakenHoursAgo + i * med.intervalHours) * HOUR
      doses.push({
        id: uuid(),
        medId: id,
        takenAt,
        status: 'taken' as const,
        createdAt: takenAt,
        updatedAt: takenAt,
      })
    }
    await db.doses.bulkAdd(doses)
  }

  // Timer presets in colour.
  await db.timerPresets.bulkAdd(
    data.presets.map((preset, index) => ({
      id: uuid(),
      label: preset.label,
      seconds: preset.minutes * 60,
      soundId: preset.soundId ?? 'classic',
      color: preset.color,
      repeat: 0 as const,
      order: (index + 1) * 1000,
      createdAt: now,
      updatedAt: now,
    })),
  )

  // Three months of writing and focus, for the Home dashboard.
  let noise = 7
  const random = () => ((noise = (noise * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 90; i++) {
    const day = addDays(today, -i)
    if (random() < 0.25) continue
    const edits = Math.round(2 + random() * 18)
    await db.activity.put({
      day,
      edits,
      created: Math.round(random() * 3),
      words: edits * 40,
      updatedAt: now,
    })
    if (random() < 0.6) {
      const startedAt = now - i * 24 * HOUR
      await db.focusSessions.add({
        id: uuid(),
        day,
        startedAt,
        minutes: 25 * Math.ceil(random() * 3),
        createdAt: startedAt,
        updatedAt: startedAt,
      })
    }
  }

  // The vault: created with the real key wrapping, items sealed with the real key.
  const { meta, key } = await createVault(data.vaultPassword)
  await db.secretsMeta.put(meta)
  for (const [index, secret] of data.secrets.entries()) {
    const id = uuid()
    const value: SecretData = {
      kind: secret.kind,
      title: secret.title,
      favorite: secret.favorite ?? false,
      fields: KIND_FIELDS[secret.kind].map((field) => ({
        key: field.key,
        label: '',
        value: secret.fields[field.key] ?? '',
        secret: field.secret,
        custom: false,
      })),
    }
    await db.secretItems.add({
      id,
      envelope: await sealItem(key, id, value),
      order: (index + 1) * 1000,
      createdAt: now,
      updatedAt: now,
    })
  }
}
