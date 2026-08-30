import { db } from '../db'
import { now, type Note, type Version } from '../schema'
import { uuid } from '$lib/utils/uuid'

/**
 * Note history.
 *
 * Snapshots are text, so they cost almost nothing to keep, and they are the
 * cheapest possible insurance against the one failure mode a notes app cannot
 * excuse: destroying something the user wrote. Encrypted notes are snapshotted
 * as ciphertext, so history never becomes a plaintext side channel.
 */

/** Keep at most this many snapshots per note; older ones are pruned. */
export const MAX_VERSIONS = 30

/** Do not snapshot again within this window unless the text really changed. */
const MIN_INTERVAL_MS = 5 * 60_000

export async function listVersions(noteId: string): Promise<Version[]> {
  const versions = await db.versions.where('noteId').equals(noteId).toArray()
  return versions.sort((a, b) => b.createdAt - a.createdAt)
}

export async function latestVersion(noteId: string): Promise<Version | undefined> {
  return (await listVersions(noteId))[0]
}

/**
 * Records a snapshot if it is worth recording.
 *
 * Nothing is stored when the text is unchanged, or when the last snapshot is
 * recent — otherwise a long editing session would fill the history with dozens
 * of near-identical rows and bury the version the user actually wants.
 */
export async function snapshot(note: Note, force = false): Promise<Version | null> {
  const previous = await latestVersion(note.id)

  if (previous) {
    if (previous.body === note.body && previous.title === note.title) return null
    if (!force && now() - previous.createdAt < MIN_INTERVAL_MS) return null
  } else if (!note.body.trim() && !note.title.trim()) {
    return null
  }

  const version: Version = {
    id: uuid(),
    noteId: note.id,
    title: note.title,
    body: note.body,
    createdAt: now(),
  }

  await db.versions.add(version)
  await prune(note.id)
  return version
}

async function prune(noteId: string): Promise<void> {
  const versions = await listVersions(noteId)
  if (versions.length <= MAX_VERSIONS) return
  await db.versions.bulkDelete(versions.slice(MAX_VERSIONS).map((v) => v.id))
}

export async function deleteVersion(id: string): Promise<void> {
  await db.versions.delete(id)
}

export interface DiffLine {
  kind: 'same' | 'added' | 'removed'
  text: string
}

/**
 * Line diff via the classic LCS table.
 *
 * Notes are short enough that the O(n*m) table is never a problem, and an exact
 * diff is far more useful than a heuristic when someone is deciding whether to
 * restore an old version.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')

  const lengths: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i]![j] =
        a[i] === b[j] ? lengths[i + 1]![j + 1]! + 1 : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i]! })
      i++
      j++
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      out.push({ kind: 'removed', text: a[i]! })
      i++
    } else {
      out.push({ kind: 'added', text: b[j]! })
      j++
    }
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++]! })
  while (j < b.length) out.push({ kind: 'added', text: b[j++]! })

  return out
}

export function diffSummary(lines: DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((l) => l.kind === 'added').length,
    removed: lines.filter((l) => l.kind === 'removed').length,
  }
}
