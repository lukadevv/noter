import { describe, expect, it } from 'vitest'
import { parseQuery, textTerms } from '$lib/search/query'
import { buildContext, matches } from '$lib/search/evaluate'
import { ROOT, type Folder, type Note } from '$lib/db/schema'

function note(patch: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Parser design',
    folderId: ROOT,
    body: 'Notes about the parser.',
    view: 'doc',
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
    createdAt: Date.parse('2026-01-01'),
    updatedAt: Date.parse('2026-08-20'),
    ...patch,
  }
}

const folders: Folder[] = [
  {
    id: 'f1',
    name: 'Projects',
    parentId: ROOT,
    icon: 'lucide:folder',
    color: null,
    order: 1,
    collapsed: false,
    encrypted: 0,
    kdf: null,
    verifier: null,
    createdAt: 0,
    updatedAt: 0,
  },
]

const NOW = Date.parse('2026-08-29')
const context = buildContext(folders, NOW)

function run(query: string, target: Note): boolean {
  return matches(target, parseQuery(query).node, context)
}

describe('query parsing', () => {
  it('parses bare words as text terms', () => {
    expect(textTerms(parseQuery('parser design').node)).toEqual(['parser', 'design'])
  })

  it('parses field filters with comparisons', () => {
    expect(parseQuery('modified:<7d').node).toEqual({
      type: 'field',
      field: 'modified',
      op: '<',
      value: '7d',
    })
  })

  it('treats an unknown field as plain text and warns', () => {
    const result = parseQuery('colour:red')
    expect(result.warnings[0]).toContain('colour')
    expect(result.node).toEqual({ type: 'text', value: 'colour:red' })
  })

  it('supports quoted phrases', () => {
    expect(parseQuery('"exact phrase"').node).toEqual({ type: 'text', value: 'exact phrase' })
  })

  it('supports AND, OR, NOT and parentheses', () => {
    const node = parseQuery('tag:a AND (tag:b OR tag:c) NOT tag:d').node
    expect(node?.type).toBe('and')
  })

  it('reports an unbalanced parenthesis without throwing', () => {
    expect(parseQuery('(tag:a').warnings[0]).toContain('parenthesis')
  })

  it('returns a null node for an empty query', () => {
    expect(parseQuery('   ').node).toBeNull()
  })
})

describe('query evaluation', () => {
  it('matches free text against title, body and tags', () => {
    expect(run('parser', note())).toBe(true)
    expect(run('kitchen', note())).toBe(false)
    expect(run('urgent', note({ tags: ['urgent'] }))).toBe(true)
  })

  it('filters by tag, folder and view', () => {
    expect(run('tag:bug', note({ tags: ['bug'] }))).toBe(true)
    expect(run('tag:bug', note({ tags: ['chore'] }))).toBe(false)
    expect(run('folder:projects', note({ folderId: 'f1' }))).toBe(true)
    // `view:` now means "has a block of that kind".
    expect(run('view:checklist', note({ body: '- [ ] milk' }))).toBe(true)
    expect(run('view:checklist', note({ body: 'no tasks' }))).toBe(false)
    expect(run('view:board', note({ body: '```board\n## A\n```' }))).toBe(true)
    expect(run('view:code', note({ body: '```rust\nfn main() {}\n```' }))).toBe(true)
    expect(run('lang:rust', note({ body: '```rust\nfn main() {}\n```' }))).toBe(true)
  })

  it('filters by state', () => {
    expect(run('is:pinned', note({ pinned: 1 }))).toBe(true)
    expect(run('is:archived', note({ archivedAt: 1 }))).toBe(true)
    expect(run('is:daily', note({ daily: '2026-08-29' }))).toBe(true)
  })

  it('distinguishes finished from unfinished checklists', () => {
    const done = note({ body: '- [x] a\n- [x] b' })
    const todo = note({ body: '- [x] a\n- [ ] b' })
    expect(run('is:done', done)).toBe(true)
    expect(run('is:todo', done)).toBe(false)
    expect(run('is:todo', todo)).toBe(true)
    // A note with no tasks is neither done nor to-do.
    expect(run('is:done', note())).toBe(false)
  })

  it('filters by content presence', () => {
    expect(run('has:task', note({ body: '- [ ] a' }))).toBe(true)
    expect(run('has:link', note({ body: 'see [[Other]]' }))).toBe(true)
    expect(run('has:image', note({ body: '![[img:11111111-1111-4111-8111-111111111111]]' }))).toBe(true)
    expect(run('has:image', note())).toBe(false)
  })

  it('reads modified:<7d as "within the last 7 days"', () => {
    const recent = note({ updatedAt: NOW - 2 * 86_400_000 })
    const old = note({ updatedAt: NOW - 40 * 86_400_000 })
    expect(run('modified:<7d', recent)).toBe(true)
    expect(run('modified:<7d', old)).toBe(false)
    expect(run('modified:>30d', old)).toBe(true)
  })

  it('combines filters with AND by default', () => {
    const target = note({ tags: ['bug'], pinned: 1 })
    expect(run('tag:bug is:pinned', target)).toBe(true)
    expect(run('tag:bug is:archived', target)).toBe(false)
  })

  it('negates with NOT and with a leading dash', () => {
    expect(run('NOT tag:bug', note({ tags: ['chore'] }))).toBe(true)
    expect(run('-tag:bug', note({ tags: ['bug'] }))).toBe(false)
  })

  it('matches either side of an OR', () => {
    expect(run('tag:bug OR tag:chore', note({ tags: ['chore'] }))).toBe(true)
    expect(run('tag:bug OR tag:chore', note({ tags: ['other'] }))).toBe(false)
  })
})
