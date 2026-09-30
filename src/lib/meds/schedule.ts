/**
 * When the next dose is due, and how the last days went.
 *
 * Doses follow an interval from the last one actually taken, which is how
 * "every 12 hours" works in practice: take it late and the next one moves
 * with it. Pure functions over plain data, so they are tested directly.
 */
import type { Dose, Med } from '$lib/db/schema'

const HOUR = 3_600_000
const DAY = 86_400_000

export type DoseState = 'first' | 'ok' | 'soon' | 'due' | 'overdue' | 'paused'

export interface MedStatus {
  state: DoseState
  /** When the next dose is due; null before the first one is logged. */
  nextDue: number | null
  /** Milliseconds until it is due (negative when late). */
  remaining: number
  /** 0–1 through the current interval, for the progress ring. */
  progress: number
  last: Dose | null
}

/** After this long past due, "due now" becomes "overdue". */
export function graceMs(med: Pick<Med, 'intervalHours'>): number {
  return Math.min(HOUR, med.intervalHours * HOUR * 0.25)
}

export function lastDose(doses: Dose[], medId: string): Dose | null {
  let last: Dose | null = null
  for (const dose of doses) {
    if (dose.medId === medId && (!last || dose.takenAt > last.takenAt)) last = dose
  }
  return last
}

export function statusOf(med: Med, doses: Dose[], now: number): MedStatus {
  const last = lastDose(doses, med.id)
  if (!last)
    return { state: med.active ? 'first' : 'paused', nextDue: null, remaining: 0, progress: 0, last }
  const interval = med.intervalHours * HOUR
  const nextDue = last.takenAt + interval
  const remaining = nextDue - now
  const progress = Math.min(1, Math.max(0, (now - last.takenAt) / interval))
  let state: DoseState
  if (!med.active) state = 'paused'
  else if (remaining > med.leadMinutes * 60_000) state = 'ok'
  else if (remaining > 0) state = 'soon'
  else if (remaining > -graceMs(med)) state = 'due'
  else state = 'overdue'
  return { state, nextDue, remaining, progress, last }
}

/** Doses a day at this interval (at least one). */
export function perDay(med: Pick<Med, 'intervalHours'>): number {
  return Math.max(1, Math.round(24 / med.intervalHours))
}

/** Local midnight at the start of the day containing `time`. */
export function startOfDay(time: number): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

export interface DayRecord {
  day: number
  taken: number
  expected: number
}

/**
 * The last `days` days, oldest first: doses taken each day against doses
 * expected. The schedule is anchored at the first dose ever logged — slots
 * fall every interval from there — so nothing is "missed" before you started,
 * and a slot only counts once it has come due.
 */
export function history(med: Med, doses: Dose[], now: number, days = 7): DayRecord[] {
  const own = doses.filter((d) => d.medId === med.id)
  const first = own.reduce((min, d) => Math.min(min, d.takenAt), Infinity)
  const interval = med.intervalHours * HOUR
  const today = startOfDay(now)
  const records: DayRecord[] = []
  for (let i = days - 1; i >= 0; i--) {
    // Stepping by calendar day (not 24 h) keeps DST days in line.
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const day = date.getTime()
    date.setDate(date.getDate() + 1)
    const end = Math.min(date.getTime(), now + 1)
    const taken = own.filter(
      (d) => d.status === 'taken' && d.takenAt >= day && d.takenAt < date.getTime(),
    ).length
    records.push({ day, taken, expected: slotsBetween(first, interval, day, end) })
  }
  return records
}

/** Schedule slots (first + k·interval, k ≥ 0) in [from, to). */
function slotsBetween(first: number, interval: number, from: number, to: number): number {
  if (!Number.isFinite(first) || to <= first) return 0
  const lo = Math.max(0, Math.ceil((from - first) / interval))
  const hi = Math.ceil((to - first) / interval) - 1
  return Math.max(0, hi - lo + 1)
}

/** Share of expected doses taken over the window, 0–1; null with nothing expected. */
export function adherence(records: DayRecord[]): number | null {
  const expected = records.reduce((sum, r) => sum + r.expected, 0)
  if (expected === 0) return null
  const taken = records.reduce((sum, r) => sum + Math.min(r.taken, r.expected), 0)
  return taken / expected
}

/** Doses left in stock, or null when stock is not tracked. */
export function dosesLeft(med: Pick<Med, 'stock' | 'perDose'>): number | null {
  if (med.stock === null) return null
  return Math.floor(med.stock / Math.max(1, med.perDose))
}

/** Low when fewer than three days' worth of doses remain. */
export function lowStock(med: Pick<Med, 'stock' | 'perDose' | 'intervalHours'>): boolean {
  const left = dosesLeft(med)
  return left !== null && left < perDay(med) * 3
}

/** "5 h 12 min", "12 min", "2 d 3 h" — for "next in …" and "overdue by …". */
export function formatSpan(ms: number): string {
  const minutes = Math.max(1, Math.round(Math.abs(ms) / 60_000))
  const d = Math.floor(minutes / 1440)
  const h = Math.floor((minutes % 1440) / 60)
  const m = minutes % 60
  // Under two days reads better in hours: "23 h 59 min", not "0 d 23 h".
  if (d >= 2) return h ? `${d} d ${h} h` : `${d} d`
  const hours = Math.floor(minutes / 60)
  if (hours) return m ? `${hours} h ${m} min` : `${hours} h`
  return `${m} min`
}

export { DAY, HOUR }
