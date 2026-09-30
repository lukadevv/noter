import { describe, expect, it } from 'vitest'
import { formatClock, formatLength, parseDuration } from '$lib/timers/duration'

describe('parseDuration', () => {
  it('reads the ways people type durations', () => {
    expect(parseDuration('10')).toBe(600)
    expect(parseDuration('2.5')).toBe(150)
    expect(parseDuration('90s')).toBe(90)
    expect(parseDuration('1h30')).toBe(5400)
    expect(parseDuration('1h 30m')).toBe(5400)
    expect(parseDuration('45 min')).toBe(2700)
    expect(parseDuration('5:30')).toBe(330)
    expect(parseDuration('1:05:00')).toBe(3900)
  })

  it('rejects nonsense and zero', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('soon')).toBeNull()
    expect(parseDuration('0')).toBeNull()
    expect(parseDuration('10 apples')).toBeNull()
  })
})

describe('formatting', () => {
  it('formats a countdown clock', () => {
    expect(formatClock(247_000)).toBe('4:07')
    expect(formatClock(3_903_000)).toBe('1:05:03')
    expect(formatClock(-5)).toBe('0:00')
    expect(formatClock(1)).toBe('0:01')
  })

  it('formats a length', () => {
    expect(formatLength(45)).toBe('45 s')
    expect(formatLength(600)).toBe('10 min')
    expect(formatLength(5400)).toBe('1 h 30 min')
  })
})
