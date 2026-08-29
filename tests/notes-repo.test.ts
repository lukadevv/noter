import { beforeEach, describe, expect, it } from 'vitest'
import { NoterDB } from '$lib/db/db'
import { ROOT } from '$lib/db/schema'
import * as notesRepo from '$lib/db/repo/notes'
import * as foldersRepo from '$lib/db/repo/folders'

// Each suite gets its own database name so fake-indexeddb state cannot leak.
let counter = 0

async function freshDb() {
  const db = new NoterDB(`noter-test-${counter++}`)
  await db.open()
  return db
}

describe('note lifecycle', () => {
  beforeEach(async () => {
    const db = await freshDb()
    // Point the repos at this database by swapping the shared instance's tables.
    const shared = (await import('$lib/db/db')).db
    Object.assign(shared, {
      notes: db.notes,
      folders: db.folders,
      versions: db.versions,
      assets: db.assets,
      settings: db.settings,
      transaction: db.transaction.bind(db),
    })
  })

  it('creates notes at the end of their folder', async () => {
    const first = await notesRepo.createNote({ title: 'first' })
    const second = await notesRepo.createNote({ title: 'second' })
    expect(second.order).toBeGreaterThan(first.order)
  })

  it('hides trashed notes from the live list and shows them in trash', async () => {
    const note = await notesRepo.createNote({ title: 'doomed' })
    await notesRepo.trashNote(note.id)

    expect(await notesRepo.listAll()).toHaveLength(0)
    const trashed = await notesRepo.listTrashed()
    expect(trashed.map((n) => n.id)).toEqual([note.id])
  })

  it('restores a trashed note', async () => {
    const note = await notesRepo.createNote({ title: 'oops' })
    await notesRepo.trashNote(note.id)
    await notesRepo.restoreNote(note.id)

    expect((await notesRepo.listAll()).map((n) => n.id)).toEqual([note.id])
  })

  it('purges trash past the retention window and keeps the rest', async () => {
    const old = await notesRepo.createNote({ title: 'old' })
    const recent = await notesRepo.createNote({ title: 'recent' })
    const shared = (await import('$lib/db/db')).db
    await shared.notes.update(old.id, { deletedAt: Date.now() - 40 * 86_400_000 })
    await shared.notes.update(recent.id, { deletedAt: Date.now() - 2 * 86_400_000 })

    expect(await notesRepo.purgeExpiredTrash(30)).toBe(1)
    expect((await notesRepo.listTrashed()).map((n) => n.id)).toEqual([recent.id])
  })

  it('deletes a note together with its version history', async () => {
    const shared = (await import('$lib/db/db')).db
    const note = await notesRepo.createNote({ title: 'versioned' })
    await shared.versions.add({
      id: 'v1',
      noteId: note.id,
      title: 'versioned',
      body: 'old',
      createdAt: Date.now(),
    })

    await notesRepo.deleteNoteForever(note.id)
    expect(await shared.versions.where('noteId').equals(note.id).count()).toBe(0)
  })

  it('lists only the notes of the requested folder', async () => {
    const folder = await foldersRepo.createFolder({ name: 'Projects' })
    await notesRepo.createNote({ title: 'inside', folderId: folder.id })
    await notesRepo.createNote({ title: 'outside' })

    const inFolder = await notesRepo.listByFolder(folder.id)
    expect(inFolder.map((n) => n.title)).toEqual(['inside'])
    expect((await notesRepo.listByFolder(ROOT)).map((n) => n.title)).toEqual(['outside'])
  })

  it('moves a folder subtree to trash instead of destroying it', async () => {
    const parent = await foldersRepo.createFolder({ name: 'Parent' })
    const child = await foldersRepo.createFolder({ name: 'Child', parentId: parent.id })
    const note = await notesRepo.createNote({ title: 'nested', folderId: child.id })

    await foldersRepo.deleteFolder(parent.id)

    expect(await foldersRepo.allFolders()).toHaveLength(0)
    const trashed = await notesRepo.listTrashed()
    expect(trashed.map((n) => n.id)).toEqual([note.id])
  })

  it('appends a moved note after the folder it lands in', async () => {
    const folder = await foldersRepo.createFolder({ name: 'Target' })
    const first = await notesRepo.createNote({ title: 'first', folderId: folder.id })
    const second = await notesRepo.createNote({ title: 'second', folderId: folder.id })
    const incoming = await notesRepo.createNote({ title: 'incoming' })

    // No neighbours given: a fixed step would collide with what is already
    // there and leave the list in an arbitrary order.
    await notesRepo.moveNote(incoming.id, folder.id, null, null)

    const inFolder = await notesRepo.listByFolder(folder.id)
    expect(inFolder.map((n) => n.title)).toEqual(['first', 'second', 'incoming'])
    expect(inFolder[2]!.order).toBeGreaterThan(second.order)
    expect(second.order).toBeGreaterThan(first.order)
  })

  it('places a moved note between two neighbours', async () => {
    const folder = await foldersRepo.createFolder({ name: 'Target' })
    const first = await notesRepo.createNote({ title: 'first', folderId: folder.id })
    const second = await notesRepo.createNote({ title: 'second', folderId: folder.id })
    const incoming = await notesRepo.createNote({ title: 'incoming' })

    await notesRepo.moveNote(incoming.id, folder.id, first.id, second.id)

    expect((await notesRepo.listByFolder(folder.id)).map((n) => n.title)).toEqual([
      'first',
      'incoming',
      'second',
    ])
  })

  it('sorts pinned notes to the top', async () => {
    const shared = (await import('$lib/db/db')).db
    const plain = await notesRepo.createNote({ title: 'plain' })
    const pinned = await notesRepo.createNote({ title: 'pinned' })
    await shared.notes.update(pinned.id, { pinned: 1 })

    const sorted = notesRepo.sortForList(await notesRepo.listAll())
    expect(sorted.map((n) => n.id)).toEqual([pinned.id, plain.id])
  })
})

describe('note text helpers', () => {
  it('falls back to the first meaningful line for a title', () => {
    expect(notesRepo.derivedTitle({ title: '', body: '# Heading\nrest' })).toBe('Heading')
    expect(notesRepo.derivedTitle({ title: '', body: '\n\n- [ ] a task' })).toBe('a task')
    expect(notesRepo.derivedTitle({ title: '  ', body: '   ' })).toBe('Untitled')
    expect(notesRepo.derivedTitle({ title: 'Explicit', body: '# Heading' })).toBe('Explicit')
  })

  it('strips markdown noise out of previews', () => {
    const body = '# Title\n\n![[img:abc]]\n\n- [x] **done** and `code`\n\n[[Another note]]'
    const result = notesRepo.preview(body)
    expect(result).not.toContain('![[')
    expect(result).not.toContain('**')
    expect(result).toContain('done')
    expect(result).toContain('Another note')
  })

  it('truncates long previews', () => {
    expect(notesRepo.preview('x'.repeat(500), 40)).toHaveLength(41)
  })
})
