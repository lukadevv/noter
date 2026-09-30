import { db } from '../db'
import { ROOT, type Note } from '../schema'
import { createNote, deleteNoteForever, updateNote, type NewNoteInput } from './notes'
import { dayKey } from '$lib/utils/dates'
import type { DailyNoteSettings } from './settings'

/**
 * Daily notes are created lazily and never on a schedule.
 *
 * Opening today's note is what brings it into existence, and an untouched one is
 * removed again when the user leaves it. A notes app that silently accumulates
 * empty dated files every day is worse than one with no daily notes at all.
 */

export function formatDailyTitle(key: string, format: string): string {
  const [year, month, day] = key.split('-')
  if (!year || !month || !day) return key
  const date = new Date(Number(year), Number(month) - 1, Number(day))

  return format
    .replace(/YYYY/g, year)
    .replace(/MMMM/g, date.toLocaleDateString(undefined, { month: 'long' }))
    .replace(/MMM/g, date.toLocaleDateString(undefined, { month: 'short' }))
    .replace(/MM/g, month)
    .replace(/DDDD/g, date.toLocaleDateString(undefined, { weekday: 'long' }))
    .replace(/DDD/g, date.toLocaleDateString(undefined, { weekday: 'short' }))
    .replace(/DD/g, day)
}

export async function findDailyNote(key: string): Promise<Note | undefined> {
  return db.notes.where('daily').equals(key).first()
}

export async function openDailyNote(
  key: string,
  settings: DailyNoteSettings,
  templateBody = '',
  create: (input: NewNoteInput) => Promise<Note> = createNote,
): Promise<Note> {
  const existing = await findDailyNote(key)
  if (existing) {
    if (existing.deletedAt > 0) await updateNote(existing.id, { deletedAt: 0 })
    return existing
  }

  return create({
    title: formatDailyTitle(key, settings.titleFormat),
    body: templateBody,
    folderId: settings.folderId || ROOT,
    daily: key,
  })
}

/** Drops a daily note the user opened but never wrote in. */
export async function discardEmptyDailyNote(id: string): Promise<boolean> {
  const note = await db.notes.get(id)
  if (!note || note.daily === null) return false
  if (note.body.trim() !== '') return false

  await deleteNoteForever(id)
  return true
}

/** Day keys that already have a note, for marking a calendar. */
export async function daysWithNotes(): Promise<Set<string>> {
  const notes = await db.notes.where('daily').notEqual('').toArray()
  return new Set(notes.filter((n) => n.daily && n.deletedAt === 0).map((n) => n.daily!))
}

const SCRATCHPAD_TITLE = 'Scratchpad'

/**
 * The scratchpad is a single always-there note, reachable from anywhere. It has
 * no folder and never appears in lists; it exists so a thought can be captured
 * without first deciding where it belongs.
 */
export async function getScratchpad(): Promise<Note> {
  const existing = await db.notes.where('system').equals('scratchpad').first()
  if (existing) return existing
  return createNote({ title: SCRATCHPAD_TITLE, folderId: ROOT, system: 'scratchpad' })
}

export function todayKey(): string {
  return dayKey()
}
