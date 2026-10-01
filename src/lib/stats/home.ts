import type { ActivityDay, Note } from '$lib/db/schema'
import { addDays, dayKey, parseDayKey } from '$lib/utils/dates'
import { maskCode } from '$lib/md/fences'

/**
 * The numbers behind the Home dashboard. Pure functions over plain records, so
 * they are tested without a database and cost nothing until Home is opened.
 */

export interface HeatCell {
  day: string
  value: number
  /** 0 = nothing, 1–4 = quartiles of the non-zero days. */
  level: number
  /** After today: drawn empty, not as "no activity". */
  future: boolean
}

/** Monday of the week containing `day`. Weeks start on Monday everywhere here. */
export function weekStart(day: string): string {
  const date = parseDayKey(day)
  if (!date) return day
  const offset = (date.getDay() + 6) % 7
  return addDays(day, -offset)
}

/**
 * Cut points for the four shades: quartiles of the days that had any activity,
 * so one marathon day does not flatten everything else to the lightest step.
 */
export function levelThresholds(values: number[]): [number, number, number] {
  const active = values.filter((v) => v > 0).sort((a, b) => a - b)
  if (active.length === 0) return [1, 1, 1]
  const at = (q: number) => active[Math.min(active.length - 1, Math.floor(q * active.length))]!
  return [at(0.25), at(0.5), at(0.75)]
}

export function levelOf(value: number, [q1, q2, q3]: [number, number, number]): number {
  if (value <= 0) return 0
  if (value <= q1) return 1
  if (value <= q2) return 2
  if (value <= q3) return 3
  return 4
}

/** `weeks` columns of seven days (Monday first), ending with the current week. */
export function heatmap(
  rows: ActivityDay[],
  today: string,
  weeks: number,
  measure: (row: ActivityDay) => number = (row) => row.edits,
): HeatCell[][] {
  const byDay = new Map(rows.map((row) => [row.day, measure(row)]))
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  const thresholds = levelThresholds([...byDay.values()])
  const columns: HeatCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const column: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const day = addDays(first, w * 7 + d)
      const future = day > today
      const value = future ? 0 : (byDay.get(day) ?? 0)
      column.push({ day, value, level: levelOf(value, thresholds), future })
    }
    columns.push(column)
  }
  return columns
}

/** Totals per week (Monday first), oldest first, ending with the current week. */
export function weeklyTotals(
  rows: ActivityDay[],
  today: string,
  weeks: number,
  measure: (row: ActivityDay) => number,
): { week: string; value: number }[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1))
  const totals = Array.from({ length: weeks }, (_, i) => ({ week: addDays(first, i * 7), value: 0 }))
  for (const row of rows) {
    if (row.day < first || row.day > today) continue
    const index = Math.floor(daysBetween(first, row.day) / 7)
    if (totals[index]) totals[index].value += measure(row)
  }
  return totals
}

function daysBetween(from: string, to: string): number {
  const a = parseDayKey(from)!
  const b = parseDayKey(to)!
  // Rounded: a daylight-saving change makes one day 23 or 25 hours long.
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/**
 * Consecutive days with any writing, ending today - or yesterday, so the
 * streak does not read zero every morning before the first note.
 */
export function streak(rows: ActivityDay[], today: string): number {
  const active = new Set(rows.filter((r) => r.edits > 0 || r.created > 0).map((r) => r.day))
  let day = active.has(today) ? today : addDays(today, -1)
  let count = 0
  while (active.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}

/** Checklist items across readable notes. Code blocks are skipped. */
export function taskCounts(notes: Pick<Note, 'body' | 'encrypted'>[]): { open: number; done: number } {
  let open = 0
  let done = 0
  for (const note of notes) {
    if (note.encrypted) continue
    const text = maskCode(note.body)
    open += text.match(/^\s*[-*+] \[ \]/gm)?.length ?? 0
    done += text.match(/^\s*[-*+] \[[xX]\]/gm)?.length ?? 0
  }
  return { open, done }
}

/** Sum of a measure over the days in [from, to]. */
export function sumBetween(
  rows: ActivityDay[],
  from: string,
  to: string,
  measure: (row: ActivityDay) => number,
): number {
  return rows.filter((r) => r.day >= from && r.day <= to).reduce((sum, r) => sum + measure(r), 0)
}

/** The month grid for a calendar: leading blanks, then each day key. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) cells.push(dayKey(new Date(year, month, d)))
  return cells
}
