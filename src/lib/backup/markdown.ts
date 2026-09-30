import type { Folder, Note } from '$lib/db/schema'
import { ROOT } from '$lib/db/schema'
import { derivedTitle } from '$lib/db/repo/notes'
import { referencedAssetIds } from '$lib/db/repo/assets'

/**
 * Notes export as ordinary `.md` files with YAML front matter.
 *
 * The format is deliberately not proprietary: the export should open in
 * Obsidian, in a text editor, or in whatever comes next. If this app disappears,
 * the notes are still notes.
 */

// Characters no common filesystem accepts in a name, including the ASCII
// control range — written as escapes rather than as literal bytes.
// eslint-disable-next-line no-control-regex
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]/g

/** Turns a title into a filename that survives every common filesystem. */
export function safeFileName(title: string, fallback = 'untitled'): string {
  const cleaned = title
    .replace(UNSAFE, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .trim()
    .replace(/^[-.]+|[-.]+$/g, '')

  // A title made only of punctuation collapses to separators, which would give
  // files called `---.md`; fall back instead.
  const name = /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : fallback
  return name.length > 80 ? name.slice(0, 80).trim() : name
}

/** Full path of a folder, e.g. `Projects/Noter`. */
export function folderPath(folderId: string, folders: Map<string, Folder>): string {
  const parts: string[] = []
  let current = folderId
  const guard = new Set<string>()
  while (current !== ROOT && !guard.has(current)) {
    guard.add(current)
    const folder = folders.get(current)
    if (!folder) break
    parts.unshift(safeFileName(folder.name, 'folder'))
    current = folder.parentId
  }
  return parts.join('/')
}

function yamlValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => JSON.stringify(String(v))).join(', ')}]`
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

export function noteToMarkdown(note: Note): string {
  const meta: Record<string, unknown> = {
    id: note.id,
    title: derivedTitle(note),
    created: new Date(note.createdAt).toISOString(),
    updated: new Date(note.updatedAt).toISOString(),
  }
  if (note.tags.length > 0) meta.tags = note.tags
  if (note.pinned) meta.pinned = true
  if (note.archivedAt) meta.archived = true
  if (note.template) meta.template = true
  if (note.daily) meta.daily = note.daily
  if (note.lang) meta.lang = note.lang

  const front = Object.entries(meta)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join('\n')

  // Image references are rewritten to relative paths so the export browses
  // correctly outside the app.
  const body = note.body.replace(
    /!\[\[img:([0-9a-f-]{36})\]\]/g,
    (_, id: string) => `![](assets/${id}.webp)`,
  )

  return `---\n${front}\n---\n\n${body}\n`
}

export interface ParsedMarkdown {
  meta: Record<string, unknown>
  body: string
}

export function parseMarkdown(text: string): ParsedMarkdown {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { meta: {}, body: text }

  const meta: Record<string, unknown> = {}
  for (const line of match[1]!.split('\n')) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const raw = line.slice(colon + 1).trim()
    try {
      meta[key] = JSON.parse(raw)
    } catch {
      meta[key] = raw
    }
  }

  return { meta, body: text.slice(match[0].length) }
}

/** Reverses the export rewrite, turning relative asset paths back into references. */
export function restoreImageRefs(body: string): string {
  return body.replace(
    /!\[[^\]]*\]\(assets\/([0-9a-f-]{36})\.[a-z]+\)/g,
    (_, id: string) => `![[img:${id}]]`,
  )
}

export function assetsUsedBy(notes: Note[]): Set<string> {
  const ids = new Set<string>()
  for (const note of notes) {
    for (const id of referencedAssetIds(note.body)) ids.add(id)
  }
  return ids
}
