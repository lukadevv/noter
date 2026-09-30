/**
 * Tags and wiki-links are read out of the markdown itself.
 *
 * There is no separate tag editor and no link table: the text is the single
 * source of truth, and `Note.tags` is only a denormalised copy the store
 * refreshes on save so IndexedDB can index it.
 */
import { maskCode } from './fences'

/**
 * Blanks out code so its contents are never scanned. Offsets are preserved, so
 * a match found in the masked text points at the same place in the original —
 * which is what keeps backlink excerpts aligned.
 */
function stripCode(body: string): string {
  return maskCode(body).replace(/`[^`\n]*`/g, (code) => ' '.repeat(code.length))
}

// A tag starts at a word boundary, never mid-word or inside a URL fragment.
const TAG = /(^|[\s([{])#([\p{L}\p{N}][\p{L}\p{N}_/-]*)/gu

export function extractTags(body: string): string[] {
  const text = stripCode(body)
  const tags = new Set<string>()
  for (const match of text.matchAll(TAG)) {
    // `# Heading` is a heading, not a tag: the regex already requires a
    // non-space right after '#', so headings never reach here.
    tags.add(match[2]!)
  }
  return [...tags].sort()
}

export interface WikiLink {
  /** The note title being referenced. */
  target: string
  /** Display text after a `|`, if any. */
  alias: string | null
  /** True for `![[...]]`, which transcludes rather than links. */
  embed: boolean
  start: number
  end: number
}

const WIKI_LINK = /(!?)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function extractWikiLinks(body: string): WikiLink[] {
  const text = stripCode(body)
  const links: WikiLink[] = []
  for (const match of text.matchAll(WIKI_LINK)) {
    const target = match[2]!.trim()
    // `![[img:<id>]]` is an image reference, handled by the asset layer.
    if (target.startsWith('img:')) continue
    links.push({
      target,
      alias: match[3]?.trim() ?? null,
      embed: match[1] === '!',
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return links
}

/** Normalised key for matching a link to a note title. */
export function linkKey(title: string): string {
  return title.trim().toLowerCase()
}

export interface BacklinkEntry {
  noteId: string
  /** A short excerpt around the mention, for the backlinks panel. */
  context: string
}

/** Builds "which notes link to this one" from every body, in one pass. */
export function buildBacklinks(
  notes: { id: string; title: string; body: string }[],
  titleOf: (note: { id: string; title: string; body: string }) => string,
): Map<string, BacklinkEntry[]> {
  const byKey = new Map<string, string>()
  for (const note of notes) byKey.set(linkKey(titleOf(note)), note.id)

  const backlinks = new Map<string, BacklinkEntry[]>()
  for (const note of notes) {
    for (const link of extractWikiLinks(note.body)) {
      const targetId = byKey.get(linkKey(link.target))
      if (!targetId || targetId === note.id) continue
      const list = backlinks.get(targetId) ?? []
      list.push({ noteId: note.id, context: excerpt(note.body, link.start, link.end) })
      backlinks.set(targetId, list)
    }
  }
  return backlinks
}

function excerpt(body: string, start: number, end: number, radius = 60): string {
  const from = Math.max(0, start - radius)
  const to = Math.min(body.length, end + radius)
  const text = body.slice(from, to).replace(/\s+/g, ' ').trim()
  return `${from > 0 ? '…' : ''}${text}${to < body.length ? '…' : ''}`
}

/** Rewrites every `[[old]]` reference when a note is renamed. */
export function renameWikiLinks(body: string, from: string, to: string): string {
  const fromKey = linkKey(from)
  return body.replace(WIKI_LINK, (match, bang: string, target: string, alias?: string) => {
    if (linkKey(target) !== fromKey) return match
    return `${bang}[[${to}${alias ? `|${alias}` : ''}]]`
  })
}
