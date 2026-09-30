import { describe, expect, it } from 'vitest'
import { minimalChange } from '$lib/editor/cm/diff'

describe('minimalChange', () => {
  function apply(before: string, change: { from: number; to: number; insert: string }) {
    return before.slice(0, change.from) + change.insert + before.slice(change.to)
  }

  it('touches only the part that differs', () => {
    const change = minimalChange('hello world', 'hello brave world')
    expect(change).toEqual({ from: 6, to: 6, insert: 'brave ' })
  })

  it('handles deletions and full replacements', () => {
    expect(minimalChange('abcdef', 'abef')).toEqual({ from: 2, to: 4, insert: '' })
    for (const [a, b] of [
      ['', 'new'],
      ['old', ''],
      ['same', 'same'],
      ['aaa', 'aa'],
    ]) {
      expect(apply(a!, minimalChange(a!, b!))).toBe(b)
    }
  })
})
