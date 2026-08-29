import { describe, expect, it } from 'vitest'
import {
  folderPath,
  noteToMarkdown,
  parseMarkdown,
  restoreImageRefs,
  safeFileName,
} from '$lib/backup/markdown'
import { ROOT, type Folder, type Note } from '$lib/db/schema'
import { emptyNote } from '$lib/db/repo/notes'

const ASSET = '11111111-1111-4111-8111-111111111111'

function note(patch: Partial<Note> = {}): Note {
  return { ...emptyNote(), title: 'A note', body: 'Some text.', ...patch }
}

function folder(id: string, name: string, parentId: string): Folder {
  return {
    id,
    name,
    parentId,
    icon: 'lucide:folder',
    color: null,
    order: 1000,
    collapsed: false,
    encrypted: 0,
    kdf: null,
    verifier: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('safeFileName', () => {
  it('strips characters filesystems reject', () => {
    expect(safeFileName('a/b:c*d?e"f<g>h|i')).not.toMatch(/[\\/:*?"<>|]/)
  })

  it('falls back when only punctuation remains', () => {
    expect(safeFileName('///')).toBe('untitled')
    expect(safeFileName('   ')).toBe('untitled')
    expect(safeFileName('- - -')).toBe('untitled')
  })

  it('keeps a title that still has letters or digits', () => {
    expect(safeFileName('2026/03 report')).toBe('2026-03 report')
  })

  it('caps very long titles', () => {
    expect(safeFileName('x'.repeat(200)).length).toBeLessThanOrEqual(80)
  })
})

describe('folderPath', () => {
  const folders = new Map([
    ['a', folder('a', 'Projects', ROOT)],
    ['b', folder('b', 'Noter', 'a')],
  ])

  it('joins ancestors into a path', () => {
    expect(folderPath('b', folders)).toBe('Projects/Noter')
  })

  it('returns an empty path at the root', () => {
    expect(folderPath(ROOT, folders)).toBe('')
  })

  it('does not loop forever on a cyclic parent chain', () => {
    const cyclic = new Map([
      ['x', folder('x', 'X', 'y')],
      ['y', folder('y', 'Y', 'x')],
    ])
    expect(() => folderPath('x', cyclic)).not.toThrow()
  })
})

describe('markdown round trip', () => {
  it('writes front matter and body', () => {
    const text = noteToMarkdown(note({ title: 'Title', body: 'Body', tags: ['a', 'b'] }))
    expect(text.startsWith('---\n')).toBe(true)
    expect(text).toContain('title: "Title"')
    expect(text).toContain('tags: ["a", "b"]')
    expect(text).toContain('Body')
  })

  it('parses its own front matter back', () => {
    const source = note({ title: 'Round trip', body: 'Content here', tags: ['x'] })
    const parsed = parseMarkdown(noteToMarkdown(source))
    expect(parsed.meta.title).toBe('Round trip')
    expect(parsed.meta.tags).toEqual(['x'])
    expect(parsed.body.trim()).toBe('Content here')
  })

  it('treats a file without front matter as pure body', () => {
    const parsed = parseMarkdown('# Just markdown')
    expect(parsed.meta).toEqual({})
    expect(parsed.body).toBe('# Just markdown')
  })

  it('rewrites image references to relative paths and back', () => {
    const text = noteToMarkdown(note({ body: `before ![[img:${ASSET}]] after` }))
    expect(text).toContain(`![](assets/${ASSET}.webp)`)
    expect(restoreImageRefs(parseMarkdown(text).body)).toContain(`![[img:${ASSET}]]`)
  })

  it('leaves ordinary image links alone when restoring', () => {
    const body = '![alt](https://example.com/a.png)'
    expect(restoreImageRefs(body)).toBe(body)
  })
})
