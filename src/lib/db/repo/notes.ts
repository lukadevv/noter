import { db } from '../db'
import { ROOT, TRASH_RETENTION_DAYS, now, type Flag, type Note, type ViewMode } from '../schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast, orderBetween } from '$lib/utils/order'

const DAY_MS = 86_400_000

export interface NewNoteInput {
  title?: string
  body?: string
  folderId?: string
  view?: ViewMode
  tags?: string[]
  daily?: string | null
  system?: Note['system']
  template?: Flag
}

export function emptyNote(input: NewNoteInput = {}): Note {
  const ts = now()
  return {
    id: uuid(),
    title: input.title ?? '',
    folderId: input.folderId ?? ROOT,
    body: input.body ?? '',
    view: input.view ?? 'doc',
    tags: input.tags ?? [],
    pinned: 0,
    pinnedInFolder: 0,
    order: 0,
    color: null,
    icon: null,
    status: null,
    lang: null,
    template: input.template ?? 0,
    archivedAt: 0,
    deletedAt: 0,
    encrypted: 0,
    daily: input.daily ?? null,
    system: input.system ?? null,
    createdAt: ts,
    updatedAt: ts,
  }
}

export async function createNote(input: NewNoteInput = {}): Promise<Note> {
  const folderId = input.folderId ?? ROOT
  const siblings = await db.notes.where('folderId').equals(folderId).toArray()
  const note = { ...emptyNote(input), order: orderAfterLast(siblings) }
  await db.notes.add(note)
  return note
}

export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id)
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<void> {
  await db.notes.update(id, { ...patch, updatedAt: now() })
}

/**
 * Live notes in a folder. Trashed and archived notes are excluded here; the
 * dedicated trash and archive views query them explicitly.
 */
export async function listByFolder(folderId: string): Promise<Note[]> {
  const notes = await db.notes.where('[folderId+deletedAt]').equals([folderId, 0]).toArray()
  return sortForList(notes.filter((n) => n.archivedAt === 0 && n.system === null))
}

export async function listAll(): Promise<Note[]> {
  const notes = await db.notes.where('deletedAt').equals(0).toArray()
  return sortForList(notes.filter((n) => n.archivedAt === 0 && n.system === null))
}

export async function listTrashed(): Promise<Note[]> {
  return (await db.notes.where('deletedAt').above(0).toArray()).sort((a, b) => b.deletedAt - a.deletedAt)
}

export async function listArchived(): Promise<Note[]> {
  const notes = await db.notes.where('archivedAt').above(0).toArray()
  return notes.filter((n) => n.deletedAt === 0).sort((a, b) => b.archivedAt - a.archivedAt)
}

/** Pinned first, then the caller's manual order, then most recently updated. */
export function sortForList(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const aPin = a.pinned || a.pinnedInFolder
    const bPin = b.pinned || b.pinnedInFolder
    if (aPin !== bPin) return bPin - aPin
    if (a.order !== b.order) return a.order - b.order
    return b.updatedAt - a.updatedAt
  })
}

export async function trashNote(id: string): Promise<void> {
  await updateNote(id, { deletedAt: now() })
}

export async function restoreNote(id: string): Promise<void> {
  await updateNote(id, { deletedAt: 0 })
}

export async function deleteNoteForever(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.versions, async () => {
    await db.versions.where('noteId').equals(id).delete()
    await db.notes.delete(id)
  })
}

export async function emptyTrash(): Promise<number> {
  const trashed = await listTrashed()
  await Promise.all(trashed.map((n) => deleteNoteForever(n.id)))
  return trashed.length
}

/** Drops trashed notes past the retention window. Called once on startup. */
export async function purgeExpiredTrash(retentionDays = TRASH_RETENTION_DAYS): Promise<number> {
  const cutoff = now() - retentionDays * DAY_MS
  const expired = await db.notes.where('deletedAt').between(1, cutoff).toArray()
  await Promise.all(expired.map((n) => deleteNoteForever(n.id)))
  return expired.length
}

/**
 * Moves a note into a folder, optionally between two of its notes.
 *
 * With no neighbours the note lands at the end of the target folder. That order
 * is read from the folder's actual contents: a fixed step would collide with
 * whatever is already there and leave the list in an arbitrary order.
 */
export async function moveNote(
  id: string,
  folderId: string,
  before: string | null,
  after: string | null,
): Promise<void> {
  if (before === null && after === null) {
    const siblings = (await db.notes.where('folderId').equals(folderId).toArray()).filter(
      (n) => n.id !== id,
    )
    await updateNote(id, { folderId, order: orderAfterLast(siblings) })
    return
  }

  const ids = [before, after].filter((x): x is string => x !== null)
  const neighbours = await db.notes.bulkGet(ids)
  const byId = new Map(neighbours.filter((n): n is Note => !!n).map((n) => [n.id, n]))
  const order = orderBetween(
    before ? (byId.get(before)?.order ?? null) : null,
    after ? (byId.get(after)?.order ?? null) : null,
  )
  await updateNote(id, { folderId, order })
}

/** First non-empty line of the body, used when a note has no explicit title. */
export function derivedTitle(note: Pick<Note, 'title' | 'body'>): string {
  if (note.title.trim()) return note.title.trim()
  for (const line of note.body.split('\n')) {
    const text = line.replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+(\[[ xX]\]\s+)?/, '').trim()
    if (text) return text.slice(0, 120)
  }
  return 'Untitled'
}

/** Plain-text preview for note lists, with markdown noise stripped out. */
export function preview(body: string, max = 160): string {
  const text = body
    .replace(/!\[\[[^\]]+\]\]/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+(\[[ xX]\]\s+)?/gm, '')
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '$1')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > max ? text.slice(0, max) + '…' : text
}
