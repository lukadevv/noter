import { describe, expect, it } from 'vitest'
import { buildBacklinks, extractTags, extractWikiLinks, linkKey, renameWikiLinks } from '$lib/md/links'

describe('extractTags', () => {
  it('finds hashtags anywhere in a line', () => {
    expect(extractTags('work on #parser and #ui/design today')).toEqual(['parser', 'ui/design'])
  })

  it('does not treat headings as tags', () => {
    expect(extractTags('# Heading\n## Another')).toEqual([])
  })

  it('ignores hashes inside code', () => {
    expect(extractTags('`#nope` and\n```\n#alsonope\n```')).toEqual([])
  })

  it('ignores URL fragments', () => {
    expect(extractTags('see https://example.com/page#section')).toEqual([])
  })

  it('deduplicates and sorts', () => {
    expect(extractTags('#b #a #b')).toEqual(['a', 'b'])
  })

  it('accepts non-ASCII tags', () => {
    expect(extractTags('#diseño #café')).toEqual(['café', 'diseño'])
  })
})

describe('extractWikiLinks', () => {
  it('finds plain and aliased links', () => {
    const links = extractWikiLinks('see [[Other note]] and [[Target|the target]]')
    expect(links.map((l) => l.target)).toEqual(['Other note', 'Target'])
    expect(links[1]!.alias).toBe('the target')
  })

  it('marks embeds', () => {
    expect(extractWikiLinks('![[Transcluded]]')[0]!.embed).toBe(true)
  })

  it('skips image references', () => {
    expect(extractWikiLinks('![[img:11111111-1111-4111-8111-111111111111]]')).toEqual([])
  })

  it('ignores links inside code', () => {
    expect(extractWikiLinks('`[[not a link]]`')).toEqual([])
  })
})

describe('backlinks', () => {
  const notes = [
    { id: 'a', title: 'Alpha', body: 'links to [[Beta]]' },
    { id: 'b', title: 'Beta', body: 'no links here' },
    { id: 'c', title: 'Gamma', body: 'also mentions [[beta]] in lower case' },
    { id: 'd', title: 'Delta', body: 'links to [[Nothing]]' },
  ]

  it('collects incoming links, case-insensitively', () => {
    const map = buildBacklinks(notes, (n) => n.title)
    expect(map.get('b')?.map((e) => e.noteId).sort()).toEqual(['a', 'c'])
  })

  it('ignores links to notes that do not exist', () => {
    const map = buildBacklinks(notes, (n) => n.title)
    expect([...map.keys()]).toEqual(['b'])
  })

  it('does not count a note linking to itself', () => {
    const map = buildBacklinks([{ id: 'x', title: 'Self', body: '[[Self]]' }], (n) => n.title)
    expect(map.size).toBe(0)
  })

  it('includes surrounding context', () => {
    const map = buildBacklinks(notes, (n) => n.title)
    expect(map.get('b')?.[0]!.context).toContain('links to')
  })
})

describe('renameWikiLinks', () => {
  it('repoints matching links and leaves the rest alone', () => {
    const body = 'see [[Old name]] and [[Other]]'
    expect(renameWikiLinks(body, 'Old name', 'New name')).toBe('see [[New name]] and [[Other]]')
  })

  it('preserves aliases and embeds', () => {
    expect(renameWikiLinks('![[Old|shown]]', 'Old', 'New')).toBe('![[New|shown]]')
  })

  it('matches case-insensitively', () => {
    expect(renameWikiLinks('[[old NAME]]', 'Old Name', 'New')).toBe('[[New]]')
  })
})

describe('linkKey', () => {
  it('normalises whitespace and case', () => {
    expect(linkKey('  Some Title ')).toBe('some title')
  })
})
