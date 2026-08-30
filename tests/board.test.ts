import { describe, expect, it } from 'vitest'
import {
  addCard,
  addColumn,
  moveCard,
  parseBoard,
  removeCard,
  renameColumn,
  updateCardText,
} from '$lib/md/board'

const BOARD = `## To do
- write the parser
- write the tests

## Doing
- review the design

## Done
- [x] pick a stack`

describe('parseBoard', () => {
  it('turns headings into columns and items into cards', () => {
    const columns = parseBoard(BOARD)
    expect(columns.map((c) => c.title)).toEqual(['To do', 'Doing', 'Done'])
    expect(columns[0]!.cards.map((c) => c.text)).toEqual(['write the parser', 'write the tests'])
    expect(columns[2]!.cards[0]!.done).toBe(true)
  })

  it('collects loose items before the first heading into an inbox', () => {
    const columns = parseBoard('- orphan\n\n## Later\n- planned')
    expect(columns[0]!.title).toBe('Inbox')
    expect(columns[0]!.cards.map((c) => c.text)).toEqual(['orphan'])
  })

  it('treats indented items as card detail, not cards', () => {
    const columns = parseBoard('## Col\n- card\n  - detail')
    expect(columns[0]!.cards).toHaveLength(1)
  })

  it('returns no columns for an empty note', () => {
    expect(parseBoard('')).toEqual([])
  })
})

describe('moveCard', () => {
  it('moves a card to another column', () => {
    const result = parseBoard(moveCard(BOARD, 1, 1, 0))
    expect(result[0]!.cards.map((c) => c.text)).toEqual(['write the tests'])
    expect(result[1]!.cards.map((c) => c.text)).toEqual(['write the parser', 'review the design'])
  })

  it('appends when the target index is past the end', () => {
    const result = parseBoard(moveCard(BOARD, 1, 2, 99))
    expect(result[2]!.cards.map((c) => c.text)).toEqual(['pick a stack', 'write the parser'])
  })

  it('carries indented detail lines along with the card', () => {
    const body = '## A\n- card\n  - detail\n\n## B'
    const result = moveCard(body, 1, 1, 0)
    expect(result).toContain('## B\n- card\n  - detail')
  })

  it('leaves the body untouched for an unknown target column', () => {
    expect(moveCard(BOARD, 1, 9, 0)).toBe(BOARD)
  })

  it('reorders within the same column', () => {
    const result = parseBoard(moveCard(BOARD, 2, 0, 0))
    expect(result[0]!.cards.map((c) => c.text)).toEqual(['write the tests', 'write the parser'])
  })
})

describe('board edits', () => {
  it('adds a card at the end of a column', () => {
    const result = parseBoard(addCard(BOARD, 1, 'new work'))
    expect(result[1]!.cards.map((c) => c.text)).toEqual(['review the design', 'new work'])
  })

  it('adds a column at the end', () => {
    const result = parseBoard(addColumn(BOARD, 'Blocked'))
    expect(result.map((c) => c.title)).toEqual(['To do', 'Doing', 'Done', 'Blocked'])
  })

  it('renames a column without disturbing its cards', () => {
    const result = parseBoard(renameColumn(BOARD, 0, 'Backlog'))
    expect(result[0]!.title).toBe('Backlog')
    expect(result[0]!.cards).toHaveLength(2)
  })

  it('rewrites a card while keeping its checkbox', () => {
    const result = parseBoard(updateCardText(BOARD, 8, 'chose a stack'))
    expect(result[2]!.cards[0]).toMatchObject({ text: 'chose a stack', done: true })
  })

  it('removes a card and its detail lines', () => {
    const body = '## A\n- card\n  - detail\n- other'
    const result = parseBoard(removeCard(body, 1))
    expect(result[0]!.cards.map((c) => c.text)).toEqual(['other'])
  })
})
