import { describe, expect, it } from 'vitest'
import { diffLines, diffSummary } from '$lib/db/repo/versions'

describe('diffLines', () => {
  it('marks unchanged lines as the same', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'same', text: 'b' },
    ])
  })

  it('detects an inserted line', () => {
    const lines = diffLines('a\nc', 'a\nb\nc')
    expect(lines).toEqual([
      { kind: 'same', text: 'a' },
      { kind: 'added', text: 'b' },
      { kind: 'same', text: 'c' },
    ])
  })

  it('detects a removed line', () => {
    const lines = diffLines('a\nb\nc', 'a\nc')
    expect(lines.filter((l) => l.kind === 'removed')).toEqual([{ kind: 'removed', text: 'b' }])
  })

  it('represents a replaced line as a removal plus an addition', () => {
    const summary = diffSummary(diffLines('one', 'two'))
    expect(summary).toEqual({ added: 1, removed: 1 })
  })

  it('handles an empty original', () => {
    expect(diffSummary(diffLines('', 'a\nb'))).toEqual({ added: 2, removed: 1 })
  })

  it('keeps every line of both inputs accounted for', () => {
    const before = 'a\nb\nc\nd'
    const after = 'a\nx\nc\ny\nz'
    const lines = diffLines(before, after)

    const kept = lines.filter((l) => l.kind !== 'added').map((l) => l.text)
    const produced = lines.filter((l) => l.kind !== 'removed').map((l) => l.text)
    expect(kept).toEqual(before.split('\n'))
    expect(produced).toEqual(after.split('\n'))
  })

  it('finds the minimal edit for a long shared prefix', () => {
    const before = Array.from({ length: 50 }, (_, i) => `line ${i}`).join('\n')
    const after = `${before}\nnew line`
    expect(diffSummary(diffLines(before, after))).toEqual({ added: 1, removed: 0 })
  })
})
