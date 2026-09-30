import { describe, expect, it } from 'vitest'
import { ALL_NOTES, formatRoute, HOME, parseHash, sectionOf, type Route } from '../src/routes/router'

describe('hash routing', () => {
  const cases: [string, Route][] = [
    ['#/', HOME],
    ['', HOME],
    ['#/notes', ALL_NOTES],
    ['#/vault', { kind: 'vault' }],
    ['#/meds', { kind: 'meds' }],
    ['#/timers', { kind: 'timers' }],
    ['#/timers/pomodoro', { kind: 'timers', tab: 'pomodoro' }],
    ['#/timers/stopwatch', { kind: 'timers', tab: 'stopwatch' }],
    ['#/habits', { kind: 'habits' }],
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

  it('maps routes to their navigation section', () => {
    expect(sectionOf(HOME)).toBe('home')
    expect(sectionOf({ kind: 'trash', noteId: null })).toBe('notes')
    expect(sectionOf({ kind: 'vault' })).toBe('vault')
    expect(sectionOf({ kind: 'settings', section: null })).toBeNull()
  })

  it('falls back home for unknown paths', () => {
    expect(parseHash('#/nonsense/deep')).toEqual(HOME)
  })
})
