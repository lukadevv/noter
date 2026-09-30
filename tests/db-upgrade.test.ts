import { describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { NoterDB } from '$lib/db/db'

/** The v1 schema exactly as it shipped, to seed a database from before blocks. */
class LegacyDB extends Dexie {
  constructor(name: string) {
    super(name)
    this.version(1).stores({
      notes:
        'id, folderId, updatedAt, createdAt, deletedAt, archivedAt, pinned, daily, system, template, ' +
        '[folderId+deletedAt], [deletedAt+archivedAt], [folderId+order], *tags',
      folders: 'id, parentId, order, updatedAt, [parentId+order]',
      assets: 'id, hash, createdAt',
      versions: 'id, noteId, createdAt, [noteId+createdAt]',
      smartFolders: 'id, order',
      themes: 'id, name',
      settings: 'key',
    })
  }
}

function legacyNote(id: string, view: string, body: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: '',
    folderId: '',
    body,
    view,
    tags: [],
    pinned: 0,
    pinnedInFolder: 0,
    order: 0,
    color: null,
    icon: null,
    status: null,
    lang: null,
    template: 0,
    archivedAt: 0,
    deletedAt: 0,
    encrypted: 0,
    daily: null,
    system: null,
    createdAt: 1,
    updatedAt: 1,
    ...extra,
  }
}

describe('database upgrade to blocks', () => {
  it('rewrites board, gallery and code notes and their history', async () => {
    const name = 'noter-upgrade-1'
    const legacy = new LegacyDB(name)
    await legacy
      .table('notes')
      .bulkAdd([
        legacyNote('b', 'board', '## To do\n- milk'),
        legacyNote('c', 'code', 'print(1)', { lang: 'python' }),
        legacyNote('k', 'checklist', '- [ ] a'),
        legacyNote('e', 'board', 'noter:enc:v1:abc:def', { encrypted: 1 }),
      ])
    await legacy
      .table('versions')
      .add({ id: 'v', noteId: 'b', title: '', body: '## Old\n- x', createdAt: 1 })
    legacy.close()

    const db = new NoterDB(name)
    await db.open()
    const notes = new Map((await db.notes.toArray()).map((n) => [n.id, n]))
    expect(notes.get('b')).toMatchObject({
      view: 'doc',
      body: '```board\n## To do\n- milk\n```',
      updatedAt: 1,
    })
    expect(notes.get('c')).toMatchObject({ view: 'doc', body: '```python\nprint(1)\n```' })
    expect(notes.get('k')).toMatchObject({ view: 'doc', body: '- [ ] a' })
    // Ciphertext cannot be rewritten; it keeps its view for when it is revealed.
    expect(notes.get('e')).toMatchObject({ view: 'board', body: 'noter:enc:v1:abc:def' })
    expect((await db.versions.get('v'))!.body).toBe('```board\n## Old\n- x\n```')
    db.close()
  })
})
