/**
 * Habit arithmetic: which days a habit is on, whether a day counts as done,
 * and streaks. Pure functions over day keys (local YYYY-MM-DD), so they are
 * tested directly and never trip over time zones or DST.
 */
import type { Habit, HabitCheck } from '$lib/db/schema'
import { addDays, parseDayKey } from '$lib/utils/dates'
import { weekStart } from '$lib/stats/home'

type Schedulable = Pick<Habit, 'schedule' | 'target'>

/** 0 = Sunday … 6 = Saturday. */
export function weekday(day: string): number {
  return parseDayKey(day)?.getDay() ?? 0
}

/** Whether the habit is asked of you on this day. Weekly habits are on every day until met. */
export function isScheduled(habit: Schedulable, day: string): boolean {
  switch (habit.schedule.kind) {
    case 'daily':
    case 'perWeek':
      return true
    case 'weekdays':
      return habit.schedule.days.includes(weekday(day))
  }
}

/** Counts by day for one habit. */
export function countsByDay(checks: HabitCheck[], habitId: string): Map<string, number> {
  const map = new Map<string, number>()
  for (const check of checks) if (check.habitId === habitId) map.set(check.day, check.count)
  return map
}

export function isDone(habit: Schedulable, count: number): boolean {
  return count >= Math.max(1, habit.target)
}

/** Days in the week containing `day` (Monday first) on which the habit was done. */
export function doneInWeek(habit: Schedulable, counts: Map<string, number>, day: string): number {
  const start = weekStart(day)
  let done = 0
  for (let i = 0; i < 7; i++) if (isDone(habit, counts.get(addDays(start, i)) ?? 0)) done++
  return done
}

/** Whether today still needs doing: scheduled, not done, and (weekly) the week not met yet. */
export function isDueToday(habit: Schedulable, counts: Map<string, number>, today: string): boolean {
  if (!isScheduled(habit, today) || isDone(habit, counts.get(today) ?? 0)) return false
  if (habit.schedule.kind === 'perWeek') return doneInWeek(habit, counts, today) < habit.schedule.times
  return true
}

export interface Streak {
  current: number
  best: number
  /** Days for daily and weekday habits, weeks for weekly ones. */
  unit: 'days' | 'weeks'
}

/**
 * The run of scheduled days (or weeks) done, ending today. Today not being done
 * yet does not break it — the day is not over — and unscheduled days are
 * skipped rather than counted as misses. `since` bounds the walk back.
 */
export function streak(
  habit: Schedulable,
  counts: Map<string, number>,
  today: string,
  since: string,
): Streak {
  if (habit.schedule.kind === 'perWeek') {
    const times = habit.schedule.times
    const met = (week: string) => doneInWeek(habit, counts, week) >= times
    const weeks: boolean[] = []
    for (let w = weekStart(today); w >= weekStart(since); w = addDays(w, -7)) weeks.push(met(w))
    // weeks[0] is this week: counts if met, does not break the run if not.
    return { ...runs(weeks), unit: 'weeks' }
  }
  const days: boolean[] = []
  for (let d = today; d >= since; d = addDays(d, -1)) {
    if (!isScheduled(habit, d)) continue
    days.push(isDone(habit, counts.get(d) ?? 0))
  }
  return { ...runs(days), unit: 'days' }
}

/** Current and best runs of `true`, newest first; the newest entry may be pending. */
function runs(list: boolean[]): { current: number; best: number } {
  let current = 0
  for (let i = list[0] ? 0 : 1; i < list.length && list[i]; i++) current++
  let best = 0
  let run = 0
  for (const done of list) {
    run = done ? run + 1 : 0
    best = Math.max(best, run)
  }
  return { current, best }
}

/** Share of scheduled days done over the last `days` days (today excluded if not done), 0–1. */
export function completion(
  habit: Schedulable,
  counts: Map<string, number>,
  today: string,
  days = 30,
): number | null {
  let expected = 0
  let done = 0
  for (let i = 0; i < days; i++) {
    const day = addDays(today, -i)
    const ok = isDone(habit, counts.get(day) ?? 0)
    if (i === 0 && !ok) continue
    if (habit.schedule.kind !== 'perWeek' && !isScheduled(habit, day)) continue
    if (habit.schedule.kind === 'perWeek') {
      if (ok) done++
      continue
    }
    expected++
    if (ok) done++
  }
  if (habit.schedule.kind === 'perWeek') {
    const weeks = days / 7
    return Math.min(1, done / (habit.schedule.times * weeks))
  }
  return expected === 0 ? null : done / expected
}

/** "HH:MM" today, as a timestamp. */
export function reminderAt(time: string, day: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time)
  const date = parseDayKey(day)
  if (!m || !date) return null
  date.setHours(Number(m[1]), Number(m[2]), 0, 0)
  return date.getTime()
}
