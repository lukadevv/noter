import { describe, expect, it } from 'vitest'
import { computeRange } from '$lib/utils/virtual'

describe('list windowing', () => {
  it('renders nothing for an empty list', () => {
    expect(computeRange(0, 60, 0, 800)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 })
  })

  it('covers the viewport plus overscan', () => {
    const range = computeRange(1000, 50, 0, 500, 6)
    expect(range.start).toBe(0)
    expect(range.end).toBeGreaterThanOrEqual(11)
    expect(range.padTop).toBe(0)
  })

  it('keeps total height constant while scrolling', () => {
    const rowHeight = 50
    const count = 400
    for (const scrollTop of [0, 137, 5000, 19_000]) {
      const range = computeRange(count, rowHeight, scrollTop, 600)
      const rendered = (range.end - range.start) * rowHeight
      expect(range.padTop + rendered + range.padBottom).toBe(count * rowHeight)
    }
  })

  it('never runs past the end of the list', () => {
    const range = computeRange(10, 50, 100_000, 600)
    expect(range.end).toBe(10)
    expect(range.padBottom).toBe(0)
  })
})
