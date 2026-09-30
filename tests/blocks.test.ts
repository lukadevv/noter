import { describe, expect, it } from 'vitest'
import { insertionFor, kindOfLine, stripPrefix, turnLinesInto } from '$lib/md/blocks'

const labels = {
  columns: ['To do', 'Doing', 'Done'] as [string, string, string],
  now: new Date(2026, 0, 2),
}

describe('block markup', () => {
  it('strips any block prefix', () => {
    expect(stripPrefix('## Title').text).toBe('Title')
    expect(stripPrefix('- [x] milk').text).toBe('milk')
    expect(stripPrefix('  1. first')).toEqual({ indent: '  ', text: 'first' })
    expect(stripPrefix('> [!tip] careful').text).toBe('careful')
    expect(stripPrefix('plain').text).toBe('plain')
  })

  it('recognises the kind of a line', () => {
    expect(kindOfLine('# A')).toBe('h1')
    expect(kindOfLine('- [ ] a')).toBe('task')
    expect(kindOfLine('* a')).toBe('bullet')
    expect(kindOfLine('3) a')).toBe('numbered')
    expect(kindOfLine('> [!note] a')).toBe('callout')
    expect(kindOfLine('> a')).toBe('quote')
    expect(kindOfLine('hello')).toBe('text')
  })

  it('turns lines into other kinds', () => {
    expect(turnLinesInto(['- a', '- b'], 'task')).toEqual(['- [ ] a', '- [ ] b'])
    expect(turnLinesInto(['- [ ] a', '- [x] b'], 'numbered')).toEqual(['1. a', '2. b'])
    expect(turnLinesInto(['one', 'two'], 'h2')).toEqual(['## one two'])
    expect(turnLinesInto(['## Title'], 'text')).toEqual(['Title'])
    expect(turnLinesInto(['x = 1'], 'code')).toEqual(['```', 'x = 1', '```'])
    expect(turnLinesInto(['careful'], 'callout')).toEqual(['> [!note]', '> careful'])
  })

  it('inserts boards and galleries as fences', () => {
    const board = insertionFor('board', labels)
    expect(board.text).toBe('```board\n## To do\n\n## Doing\n\n## Done\n```')
    expect(board.standalone).toBe(true)
    expect(insertionFor('gallery', labels).text).toBe('```gallery\n\n```')
    expect(insertionFor('task', labels)).toEqual({ text: '- [ ] ', cursor: 6 })
  })
})
