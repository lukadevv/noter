import { describe, expect, it } from 'vitest'
import {
  completion,
  countsByDay,
  doneInWeek,
  isDueToday,
  isScheduled,
  reminderAt,
  streak,
} from '$lib/habits/schedule'
import type { HabitCheck, HabitSchedule } from '$lib/db/schema'

const habit = (schedule: HabitSchedule, target = 1) => ({ schedule, target })

function checks(days: Record<string, number>, habitId = 'h'): HabitCheck[] {
  return Object.entries(days).map(([day, count]) => ({
    id: `${habitId}:${day}`,
    habitId,
    day,
    count,
    createdAt: 0,
    updatedAt: 0,
  }))
}

// 2026-09-30 is a Wednesday.
const TODAY = '2026-09-30'
const SINCE = '2026-01-01'

describe('habit schedule', () => {
  it('knows which weekdays a habit is on', () => {
    const weekdays = habit({ kind: 'weekdays', days: [1, 3, 5] })
    expect(isScheduled(weekdays, '2026-09-30')).toBe(true) // Wednesday
    expect(isScheduled(weekdays, '2026-10-01')).toBe(false) // Thursday
    expect(isScheduled(habit({ kind: 'daily' }), '2026-10-01')).toBe(true)
  })

  it('counts a day as done only once the target is reached', () => {
    const water = habit({ kind: 'daily' }, 8)
    const counts = countsByDay(checks({ [TODAY]: 5 }), 'h')
    expect(isDueToday(water, counts, TODAY)).toBe(true)
    counts.set(TODAY, 8)
    expect(isDueToday(water, counts, TODAY)).toBe(false)
  })

  it('stops asking for a weekly habit once the week is met', () => {
    const gym = habit({ kind: 'perWeek', times: 2 })
    const counts = countsByDay(checks({ '2026-09-28': 1, '2026-09-29': 1 }), 'h')
    expect(doneInWeek(gym, counts, TODAY)).toBe(2)
    expect(isDueToday(gym, counts, TODAY)).toBe(false)
  })
})

describe('streaks', () => {
  it('does not break the streak because today is not done yet', () => {
    const counts = countsByDay(checks({ '2026-09-27': 1, '2026-09-28': 1, '2026-09-29': 1 }), 'h')
    expect(streak(habit({ kind: 'daily' }), counts, TODAY, SINCE).current).toBe(3)
    counts.set(TODAY, 1)
    expect(streak(habit({ kind: 'daily' }), counts, TODAY, SINCE).current).toBe(4)
  })

  it('breaks on a missed day and remembers the best run', () => {
    const counts = countsByDay(
      checks({ '2026-09-20': 1, '2026-09-21': 1, '2026-09-22': 1, '2026-09-23': 1, '2026-09-29': 1 }),
      'h',
    )
    const result = streak(habit({ kind: 'daily' }), counts, TODAY, SINCE)
    expect(result.current).toBe(1)
    expect(result.best).toBe(4)
  })

  it('skips days a weekday habit is off', () => {
    // Mon/Wed/Fri: Fri 25, Mon 28 done; the weekend in between is not a miss.
    const counts = countsByDay(checks({ '2026-09-25': 1, '2026-09-28': 1 }), 'h')
    expect(streak(habit({ kind: 'weekdays', days: [1, 3, 5] }), counts, TODAY, SINCE).current).toBe(2)
  })

  it('counts weekly habits in weeks', () => {
    const counts = countsByDay(
      checks({ '2026-09-15': 1, '2026-09-17': 1, '2026-09-22': 1, '2026-09-24': 1 }),
      'h',
    )
    const result = streak(habit({ kind: 'perWeek', times: 2 }), counts, TODAY, SINCE)
    expect(result).toMatchObject({ current: 2, unit: 'weeks' })
  })
})

describe('completion and reminders', () => {
  it('rates completion over scheduled days only', () => {
    const counts = countsByDay(checks({ '2026-09-29': 1, '2026-09-28': 1 }), 'h')
    expect(completion(habit({ kind: 'daily' }), counts, TODAY, 4)).toBeCloseTo(2 / 3)
  })

  it('turns a reminder time into a timestamp on that day', () => {
    const at = reminderAt('08:30', TODAY)!
    expect(new Date(at).getHours()).toBe(8)
    expect(new Date(at).getMinutes()).toBe(30)
    expect(reminderAt('nope', TODAY)).toBeNull()
  })
})
