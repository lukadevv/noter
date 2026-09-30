import { describe, expect, it } from 'vitest'
import {
  heatmap,
  levelOf,
  levelThresholds,
  monthGrid,
  streak,
  sumBetween,
  taskCounts,
  weekStart,
  weeklyTotals,
} from '$lib/stats/home'
import { countWords } from '$lib/db/repo/activity'
import type { ActivityDay } from '$lib/db/schema'

const day = (d: string, edits = 1, words = 0, created = 0): ActivityDay => ({
  day: d,
  edits,
  words,
  created,
  updatedAt: 0,
})

describe('weekStart', () => {
  it('goes back to Monday', () => {
    expect(weekStart('2026-09-30')).toBe('2026-09-28') // a Wednesday
    expect(weekStart('2026-09-28')).toBe('2026-09-28')
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // Sunday belongs to the week before
  })
})

describe('heatmap', () => {
  it('lays out whole weeks ending with the current one', () => {
    const grid = heatmap([day('2026-09-29', 3)], '2026-09-30', 4)
    expect(grid).toHaveLength(4)
    expect(grid.every((column) => column.length === 7)).toBe(true)
    expect(grid[0]![0]!.day).toBe('2026-09-07')
    const last = grid[3]!
    expect(last[1]).toMatchObject({ day: '2026-09-29', value: 3, future: false })
    expect(last[2]!.future).toBe(false)
    expect(last[3]!.future).toBe(true)
  })

  it('shades by quartile so one busy day does not wash out the rest', () => {
    const thresholds = levelThresholds([1, 2, 3, 4, 100])
    expect(levelOf(0, thresholds)).toBe(0)
    expect(levelOf(1, thresholds)).toBe(1)
    expect(levelOf(100, thresholds)).toBe(4)
    expect(levelOf(4, thresholds)).toBeLessThan(4)
  })
})

describe('weeklyTotals', () => {
  it('sums each week and ignores days outside the range', () => {
    const rows = [
      day('2026-09-28', 1, 10),
      day('2026-09-30', 1, 5),
      day('2026-09-21', 1, 7),
      day('2025-01-01', 1, 99),
    ]
    const totals = weeklyTotals(rows, '2026-09-30', 2, (r) => r.words)
    expect(totals).toEqual([
      { week: '2026-09-21', value: 7 },
      { week: '2026-09-28', value: 15 },
    ])
  })
})

describe('streak', () => {
  it('counts back from today', () => {
    expect(streak([day('2026-09-30'), day('2026-09-29'), day('2026-09-27')], '2026-09-30')).toBe(2)
  })

  it('still counts yesterday’s streak before today’s first edit', () => {
    expect(streak([day('2026-09-29'), day('2026-09-28')], '2026-09-30')).toBe(2)
  })

  it('is zero after a gap', () => {
    expect(streak([day('2026-09-27')], '2026-09-30')).toBe(0)
    expect(streak([day('2026-09-30', 0)], '2026-09-30')).toBe(0)
  })
})

describe('taskCounts', () => {
  it('counts open and done items outside code, skipping encrypted notes', () => {
    const notes = [
      { body: '- [ ] one\n- [x] two\n* [X] three', encrypted: 0 as const },
      { body: '```\n- [ ] not a task\n```\n- [ ] four', encrypted: 0 as const },
      { body: '- [ ] secret', encrypted: 1 as const },
    ]
    expect(taskCounts(notes)).toEqual({ open: 2, done: 2 })
  })
})

describe('sumBetween', () => {
  it('includes both ends', () => {
    const rows = [day('2026-09-28', 1, 4), day('2026-09-30', 1, 6), day('2026-10-01', 1, 100)]
    expect(sumBetween(rows, '2026-09-28', '2026-09-30', (r) => r.words)).toBe(10)
  })
})

describe('monthGrid', () => {
  it('pads to Monday and lists every day', () => {
    const grid = monthGrid(2026, 8) // September 2026 starts on a Tuesday
    expect(grid[0]).toBeNull()
    expect(grid[1]).toBe('2026-09-01')
    expect(grid.filter(Boolean)).toHaveLength(30)
  })
})

describe('countWords', () => {
  it('counts words in any script and ignores punctuation', () => {
    expect(countWords('Hello, world — 42 times!')).toBe(4)
    expect(countWords('')).toBe(0)
    expect(countWords('café niño')).toBe(2)
  })
})
