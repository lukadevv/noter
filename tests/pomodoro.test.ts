import { describe, expect, it } from 'vitest'
import { nextStep } from '$lib/timers/pomodoro'
import { elapsed, extremes, formatStopwatch, laps, withoutLap } from '$lib/timers/stopwatch'

describe('pomodoro cycle', () => {
  const settings = { longEvery: 4 }

  it('alternates focus and short breaks', () => {
    expect(nextStep({ phase: 'focus', cycle: 0 }, settings)).toEqual({ phase: 'short', cycle: 1 })
    expect(nextStep({ phase: 'short', cycle: 1 }, settings)).toEqual({ phase: 'focus', cycle: 1 })
  })

  it('takes a long break after every fourth focus session, then starts over', () => {
    expect(nextStep({ phase: 'focus', cycle: 3 }, settings)).toEqual({ phase: 'long', cycle: 4 })
    expect(nextStep({ phase: 'long', cycle: 4 }, settings)).toEqual({ phase: 'focus', cycle: 0 })
  })
})

describe('stopwatch', () => {
  const watch = { id: 'main', startedAt: 0, accumulated: 0, laps: [] as number[], updatedAt: 0 }

  it('adds the running stretch to what came before', () => {
    expect(elapsed({ ...watch, accumulated: 5000 }, 99)).toBe(5000)
    expect(elapsed({ ...watch, accumulated: 5000, startedAt: 1000 }, 3500)).toBe(7500)
  })

  it('splits laps and marks the fastest and slowest', () => {
    const list = laps({ ...watch, laps: [10_000, 18_000, 30_000] })
    expect(list.map((l) => l.split)).toEqual([12_000, 8_000, 10_000])
    expect(extremes(list)).toEqual({ best: 2, worst: 3 })
    expect(extremes(list.slice(0, 1))).toBeNull()
  })

  it('drops a lap by number and folds its time into the next split', () => {
    const marks = withoutLap([10_000, 18_000, 30_000], 2)
    expect(marks).toEqual([10_000, 30_000])
    expect(laps({ ...watch, laps: marks }).map((l) => l.split)).toEqual([20_000, 10_000])
    expect(withoutLap([10_000], 5)).toEqual([10_000])
  })

  it('formats hundredths, and hours only when there are any', () => {
    expect(formatStopwatch(61_230)).toBe('01:01.23')
    expect(formatStopwatch(3_723_450)).toBe('1:02:03.45')
  })
})
