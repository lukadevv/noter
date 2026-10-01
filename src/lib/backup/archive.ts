import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { db } from '$lib/db/db'
import { ROOT, type Folder, type Note } from '$lib/db/schema'
import { derivedTitle, emptyNote } from '$lib/db/repo/notes'
import { extractTags } from '$lib/md/links'
import { lockRoots } from '$lib/crypto/lock-root'
import { folderPath, noteToMarkdown, parseMarkdown, restoreImageRefs, safeFileName } from './markdown'
import { uuid } from '$lib/utils/uuid'
import { migrateBodyForView } from '$lib/md/migrate'

/**
 * Human-readable export: a folder tree of `.md` files plus the images they use.
 *
 * This is the archival format. The `.noter` vault is better for moving between
 * machines because it round-trips everything exactly, but a zip of markdown is
 * what makes the data genuinely portable to other tools.
 */

export interface ExportOptions {
  /** Include notes currently in the trash. */
  includeTrashed?: boolean
  /** Include the images referenced by the exported notes. */
  includeAssets?: boolean
}

export async function exportMarkdownArchive(options: ExportOptions = {}): Promise<Blob> {
  const [allNotes, folders, assets] = await Promise.all([
    db.notes.toArray(),
    db.folders.toArray(),
    db.assets.toArray(),
  ])

  // Notes in an encrypted folder stay out even if one is not sealed yet.
  const protectedFolders = lockRoots(folders)
  const notes = allNotes.filter((note) => {
    if (note.encrypted || protectedFolders.has(note.folderId)) return false // Ciphertext in a plain-text archive helps nobody.
    if (!options.includeTrashed && note.deletedAt > 0) return false
    return true
  })

  const folderMap = new Map(folders.map((f) => [f.id, f]))
  const files: Record<string, Uint8Array> = {}
  const used = new Set<string>()

  for (const note of notes) {
    const directory = note.deletedAt > 0 ? 'trash' : folderPath(note.folderId, folderMap)
    const base = safeFileName(derivedTitle(note))

    // Two notes can legitimately share a title; the id suffix keeps both.
    let path = `${directory ? `${directory}/` : ''}${base}.md`
    if (files[path]) path = `${directory ? `${directory}/` : ''}${base}-${note.id.slice(0, 8)}.md`

    files[path] = strToU8(noteToMarkdown(note))
    for (const match of note.body.matchAll(/!\[\[img:([0-9a-f-]{36})\]\]/g)) used.add(match[1]!)
  }

  if (options.includeAssets !== false) {
    for (const asset of assets) {
      if (!used.has(asset.id)) continue
      const extension = asset.mime.split('/')[1]?.replace('+xml', '') ?? 'bin'
      files[`assets/${asset.id}.${extension}`] = new Uint8Array(await asset.blob.arrayBuffer())
    }
  }

  files['README.md'] = strToU8(
    [
      '# Noter export',
      '',
      `Exported ${new Date().toISOString()}.`,
      '',
      'Each note is a Markdown file with YAML front matter. Images live in `assets/`',
      'and are referenced with relative paths, so this archive opens in Obsidian or',
      'any text editor without conversion.',
      '',
      'Encrypted notes are not included: they would only be unreadable ciphertext here.',
      'Use the `.noter` vault backup to move those between machines.',
      '',
    ].join('\n'),
  )

  return new Blob([zipSync(files, { level: 6 }) as BlobPart], { type: 'application/zip' })
}

export interface ImportSummary {
  notes: number
  folders: number
  skipped: number
}

/** Recreates the folder tree named by an archive's paths. */
async function ensureFolderPath(
  path: string,
  cache: Map<string, string>,
  created: { count: number },
): Promise<string> {
  if (!path) return ROOT
  const cached = cache.get(path)
  if (cached) return cached

  const segments = path.split('/').filter(Boolean)
  let parentId = ROOT
  let accumulated = ''

  for (const segment of segments) {
    accumulated = accumulated ? `${accumulated}/${segment}` : segment
    const known = cache.get(accumulated)
    if (known) {
      parentId = known
      continue
    }

    const siblings = await db.folders.where('parentId').equals(parentId).toArray()
    const existing = siblings.find((f) => f.name === segment)
    if (existing) {
      cache.set(accumulated, existing.id)
      parentId = existing.id
      continue
    }

    const folder: Folder = {
      id: uuid(),
      name: segment,
      parentId,
      icon: 'lucide:folder',
      color: null,
      order: (siblings.length + 1) * 1000,
      collapsed: false,
      encrypted: 0,
      kdf: null,
      verifier: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.folders.add(folder)
    created.count++
    cache.set(accumulated, folder.id)
    parentId = folder.id
  }

  return parentId
}

export async function importMarkdownArchive(file: Blob): Promise<ImportSummary> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  const summary: ImportSummary = { notes: 0, folders: 0, skipped: 0 }
  const folderCache = new Map<string, string>()
  const created = { count: 0 }

  for (const [path, bytes] of Object.entries(entries)) {
    if (!path.endsWith('.md') || path === 'README.md') continue

    const parsed = parseMarkdown(strFromU8(bytes))
    const directory = path.split('/').slice(0, -1).join('/')
    const folderId = await ensureFolderPath(directory === 'trash' ? '' : directory, folderCache, created)

    const id = typeof parsed.meta.id === 'string' ? parsed.meta.id : uuid()
    const existing = await db.notes.get(id)
    const updated = typeof parsed.meta.updated === 'string' ? Date.parse(parsed.meta.updated) : Date.now()

    if (existing && existing.updatedAt >= updated) {
      summary.skipped++
      continue
    }

    const lang = typeof parsed.meta.lang === 'string' ? parsed.meta.lang : null
    // Archives from before blocks say which single view the note used.
    const view = (parsed.meta.view as Note['view']) ?? 'doc'
    const body = migrateBodyForView(view, restoreImageRefs(parsed.body).trimStart(), lang)
    const note: Note = {
      ...emptyNote(),
      id,
      title: typeof parsed.meta.title === 'string' ? parsed.meta.title : '',
      folderId,
      body,
      tags: extractTags(body),
      view: 'doc',
      pinned: parsed.meta.pinned === true ? 1 : 0,
      template: parsed.meta.template === true ? 1 : 0,
      archivedAt: parsed.meta.archived === true ? Date.now() : 0,
      deletedAt: path.startsWith('trash/') ? Date.now() : 0,
      daily: typeof parsed.meta.daily === 'string' ? parsed.meta.daily : null,
      lang,
      createdAt: typeof parsed.meta.created === 'string' ? Date.parse(parsed.meta.created) : Date.now(),
      updatedAt: Number.isNaN(updated) ? Date.now() : updated,
    }

    await db.notes.put(note)
    summary.notes++
  }

  summary.folders = created.count
  return summary
}

/**
 * Hands a generated file to the user.
 *
 * Re-exported from the platform layer so callers keep importing it from here;
 * what actually happens depends on the shell the app is running in.
 */
export { saveFile as download } from '$lib/platform/save-file'

export function archiveFileName(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return `noter-markdown-${stamp}.zip`
}
