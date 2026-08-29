import type { Node } from './query'
import type { Folder, Note } from '$lib/db/schema'
import { taskStats } from '$lib/md/tasks'
import { referencedAssetIds } from '$lib/db/repo/assets'

export interface EvalContext {
  /** Folder id to lowercase name, so `folder:projects` reads naturally. */
  folderNames: Map<string, string>
  now: number
}

const DAY_MS = 86_400_000

/** Parses `7d`, `2w`, `3m`, or an ISO date, into an absolute timestamp. */
function resolveDate(value: string, now: number): number | null {
  const relative = /^(\d+)\s*([dwmy])$/i.exec(value)
  if (relative) {
    const amount = Number(relative[1])
    const unit = relative[2]!.toLowerCase()
    const days = unit === 'd' ? 1 : unit === 'w' ? 7 : unit === 'm' ? 30 : 365
    return now - amount * days * DAY_MS
  }
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * `modified:<7d` reads as "modified less than 7 days ago", so `<` means *more
 * recent than* the cutoff even though the cutoff timestamp is smaller. Getting
 * this backwards is the classic bug in date filters, hence the explicit note.
 */
function compareDate(timestamp: number, op: string, value: string, now: number): boolean {
  const cutoff = resolveDate(value, now)
  if (cutoff === null) return false
  if (op === '<') return timestamp >= cutoff
  if (op === '>') return timestamp <= cutoff
  return Math.abs(timestamp - cutoff) < DAY_MS
}

function matchesField(note: Note, node: Extract<Node, { type: 'field' }>, context: EvalContext): boolean {
  const value = node.value.toLowerCase()

  switch (node.field) {
    case 'tag':
      return note.tags.some((tag) => tag.toLowerCase() === value)
    case 'folder': {
      const name = context.folderNames.get(note.folderId)
      return name === value || note.folderId === node.value
    }
    case 'view':
      return note.view === value
    case 'lang':
      return (note.lang ?? '').toLowerCase() === value
    case 'title':
      return note.title.toLowerCase().includes(value)
    case 'is':
      switch (value) {
        case 'pinned':
          return note.pinned === 1 || note.pinnedInFolder === 1
        case 'archived':
          return note.archivedAt > 0
        case 'trashed':
          return note.deletedAt > 0
        case 'template':
          return note.template === 1
        case 'daily':
          return note.daily !== null
        case 'encrypted':
          return note.encrypted === 1
        case 'done': {
          const stats = taskStats(note.body)
          return stats.total > 0 && stats.done === stats.total
        }
        case 'todo': {
          const stats = taskStats(note.body)
          return stats.total > 0 && stats.done < stats.total
        }
        default:
          return false
      }
    case 'has':
      switch (value) {
        case 'image':
          return referencedAssetIds(note.body).length > 0
        case 'task':
          return taskStats(note.body).total > 0
        case 'link':
          return /\[\[[^\]]+\]\]/.test(note.body) || /https?:\/\//.test(note.body)
        case 'tag':
          return note.tags.length > 0
        default:
          return false
      }
    case 'modified':
      return compareDate(note.updatedAt, node.op, node.value, context.now)
    case 'created':
      return compareDate(note.createdAt, node.op, node.value, context.now)
    default:
      return false
  }
}

export function matches(note: Note, node: Node | null, context: EvalContext): boolean {
  if (!node) return true

  switch (node.type) {
    case 'text': {
      const needle = node.value.toLowerCase()
      return (
        note.title.toLowerCase().includes(needle) ||
        note.body.toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    }
    case 'field':
      return matchesField(note, node, context)
    case 'not':
      return !matches(note, node.child, context)
    case 'and':
      return node.children.every((child) => matches(note, child, context))
    case 'or':
      return node.children.some((child) => matches(note, child, context))
  }
}

export function buildContext(folders: Folder[], now = Date.now()): EvalContext {
  return {
    folderNames: new Map(folders.map((f) => [f.id, f.name.toLowerCase()])),
    now,
  }
}
