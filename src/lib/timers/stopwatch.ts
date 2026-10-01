/** Stopwatch arithmetic, kept apart from storage so it is tested directly. */
import type { Stopwatch } from '$lib/db/schema'

export const EMPTY_STOPWATCH: Stopwatch = {
  id: 'main',
  startedAt: 0,
  accumulated: 0,
  laps: [],
  updatedAt: 0,
}

export function elapsed(watch: Stopwatch, now: number): number {
  return watch.accumulated + (watch.startedAt ? Math.max(0, now - watch.startedAt) : 0)
}

export interface Lap {
  /** 1-based. */
  number: number
  /** This lap alone. */
  split: number
  /** Everything up to the end of this lap. */
  total: number
}

/** Laps newest first, each with its own split. */
export function laps(watch: Stopwatch): Lap[] {
  return watch.laps
    .map((total, i) => ({ number: i + 1, split: total - (watch.laps[i - 1] ?? 0), total }))
    .reverse()
}

/** The fastest and slowest lap numbers, once there are at least two to compare. */
export function extremes(list: Lap[]): { best: number; worst: number } | null {
  if (list.length < 2) return null
  let best = list[0]!
  let worst = list[0]!
  for (const lap of list) {
    if (lap.split < best.split) best = lap
    if (lap.split > worst.split) worst = lap
  }
  return { best: best.number, worst: worst.number }
}

/** "1:02:03.45", "02:03.45": hundredths, hours only when there are any. */
export function formatStopwatch(ms: number): string {
  const hundredths = Math.floor(ms / 10) % 100
  const total = Math.floor(ms / 1000)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${h ? `${h}:${two(m)}` : two(m)}:${two(s)}.${two(hundredths)}`
}
