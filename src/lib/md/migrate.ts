/**
 * Upgrades notes written with the old one-view-per-note model.
 *
 * Notes used to pick a single view (document, checklist, board, gallery, code)
 * that re-rendered the whole body. Blocks replaced that: a board or a gallery
 * is now a fenced block inside an ordinary note. This rewrites a body so it
 * reads the same under the new model:
 *
 *  - board   → the whole body wrapped in a ```board fence
 *  - gallery → the text stays, the images move into a ```gallery fence
 *  - code    → an unfenced body is fenced, with the note's language
 *  - checklist and doc bodies are already plain markdown
 *
 * Pure and idempotent, because it runs from several places - the database
 * upgrade, revealing an encrypted note, importing an old backup, opening an old
 * share link - and some notes pass through more than one of them.
 */
import { findFences, wrapFence } from './fences'
import type { ViewMode } from '$lib/db/schema'

const IMAGE_REF = /!\[\[img:[0-9a-f-]{36}\]\]/g

export function migrateBodyForView(
  view: ViewMode | undefined,
  body: string,
  lang: string | null = null,
): string {
  switch (view) {
    case 'board':
      return migrateBoard(body)
    case 'gallery':
      return migrateGallery(body)
    case 'code':
      return migrateCode(body, lang)
    default:
      return body
  }
}

function migrateBoard(body: string): string {
  if (findFences(body).some((f) => f.info === 'board')) return body
  return wrapFence('board', body.trim())
}

function migrateGallery(body: string): string {
  if (findFences(body).some((f) => f.info === 'gallery')) return body
  const refs = body.match(IMAGE_REF) ?? []
  const text = body
    .replace(IMAGE_REF, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const gallery = wrapFence('gallery', refs.join('\n'))
  return text ? `${text}\n\n${gallery}` : gallery
}

function migrateCode(body: string, lang: string | null): string {
  const language = lang && lang !== 'plain' ? lang : ''
  const trimmed = body.trim()
  const fences = findFences(trimmed)
  // Already a single fence spanning the body: only add a missing language.
  if (fences.length === 1 && fences[0]!.from === 0 && fences[0]!.to === trimmed.length) {
    const fence = fences[0]!
    if (fence.info || !language) return body
    const firstLineEnd = trimmed.indexOf('\n')
    return `${trimmed.slice(0, firstLineEnd < 0 ? trimmed.length : firstLineEnd)}${language}${firstLineEnd < 0 ? '' : trimmed.slice(firstLineEnd)}`
  }
  if (!trimmed) return body
  return wrapFence(language, body.replace(/\s+$/, ''))
}

/** Whether a note still needs migrating (and can be, i.e. is not ciphertext). */
export function needsMigration(note: { view?: ViewMode; encrypted?: number }): boolean {
  return !!note.view && note.view !== 'doc' && note.view !== 'checklist'
}
