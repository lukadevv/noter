import { describe, expect, it } from 'vitest'
import { addDays, dayKey, parseDayKey, relativeTime } from '$lib/utils/dates'

describe('day keys', () => {
  it('formats in local time, not UTC', () => {
    // Late-evening local times shift to the next day under toISOString().
    const evening = new Date(2026, 2, 14, 23, 30)
    expect(dayKey(evening)).toBe('2026-03-14')
  })

  it('round-trips through parseDayKey', () => {
    expect(dayKey(parseDayKey('2026-03-14')!)).toBe('2026-03-14')
  })

  it('rejects malformed keys', () => {
    expect(parseDayKey('not-a-date')).toBeNull()
  })

  it('crosses month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })
})

describe('relativeTime', () => {
  const now = new Date(2026, 2, 14, 12, 0).getTime()

  it('describes recent timestamps', () => {
    expect(relativeTime(now - 30_000, now)).toBe('just now')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5m ago')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago')
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago')
  })

  it('falls back to a date past a week', () => {
    expect(relativeTime(now - 30 * 86_400_000, now)).toMatch(/2026/)
  })
})
