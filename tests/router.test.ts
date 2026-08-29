import { describe, expect, it } from 'vitest'
import { formatRoute, HOME, parseHash, type Route } from '../src/routes/router'

describe('hash routing', () => {
  const cases: [string, Route][] = [
    ['#/', HOME],
    ['', HOME],
    ['#/f/abc', { kind: 'notes', folderId: 'abc', noteId: null }],
    ['#/f/abc/n/xyz', { kind: 'notes', folderId: 'abc', noteId: 'xyz' }],
    ['#/n/xyz', { kind: 'notes', folderId: null, noteId: 'xyz' }],
    ['#/trash', { kind: 'trash', noteId: null }],
    ['#/archive/n/xyz', { kind: 'archive', noteId: 'xyz' }],
    ['#/settings/appearance', { kind: 'settings', section: 'appearance' }],
  ]

  for (const [hash, route] of cases) {
    it(`parses ${hash || '(empty)'}`, () => {
      expect(parseHash(hash)).toEqual(route)
    })
  }

  it('round-trips every route it can format', () => {
    for (const [, route] of cases) {
      expect(parseHash(formatRoute(route))).toEqual(route)
    }
  })

  it('escapes ids that contain reserved characters', () => {
    const route: Route = { kind: 'notes', folderId: 'a/b', noteId: null }
    expect(formatRoute(route)).toBe('#/f/a%2Fb')
    expect(parseHash(formatRoute(route))).toEqual(route)
  })

  it('falls back home for unknown paths', () => {
    expect(parseHash('#/nonsense/deep')).toEqual(HOME)
  })
})
