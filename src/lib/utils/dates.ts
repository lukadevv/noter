/** Local-time YYYY-MM-DD. Never use toISOString(): it shifts to UTC. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function addDays(key: string, delta: number): string {
  const d = parseDayKey(key)
  if (!d) return key
  d.setDate(d.getDate() + delta)
  return dayKey(d)
}

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/**
 * A short "how long ago" label.
 *
 * The translator is injected rather than imported so this module stays pure and
 * testable; callers in the app pass the i18n one.
 */
export type Translate = (key: string, params?: Record<string, string | number>) => string

const DEFAULTS: Record<string, string> = {
  'common.justNow': 'just now',
  'common.minutesAgo': '{count}m ago',
  'common.hoursAgo': '{count}h ago',
  'common.daysAgo': '{count}d ago',
}

const fallback: Translate = (key, params) =>
  (DEFAULTS[key] ?? key).replace(/\{(\w+)\}/g, (_, name: string) => String(params?.[name] ?? ''))

export function relativeTime(ts: number, now = Date.now(), translate: Translate = fallback): string {
  const diff = now - ts
  if (diff < MIN) return translate('common.justNow')
  if (diff < HOUR) return translate('common.minutesAgo', { count: Math.floor(diff / MIN) })
  if (diff < DAY) return translate('common.hoursAgo', { count: Math.floor(diff / HOUR) })
  if (diff < 7 * DAY) return translate('common.daysAgo', { count: Math.floor(diff / DAY) })
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
