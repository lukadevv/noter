/**
 * Durations as people type and read them.
 *
 * Accepted input: "10" (minutes), "90s", "1h30", "1h 30m", "5:30" (m:s),
 * "1:05:00" (h:m:s), "2.5m". Returns seconds, or null when unreadable.
 */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/,/g, '.')
  if (!text) return null

  if (/^\d+(:\d{1,2}){1,2}$/.test(text)) {
    const parts = text.split(':').map(Number)
    const seconds = parts.reduce((total, part) => total * 60 + part, 0)
    return seconds > 0 ? seconds : null
  }

  if (/^\d+(\.\d+)?$/.test(text)) {
    const minutes = Number(text)
    return minutes > 0 ? Math.round(minutes * 60) : null
  }

  const pattern = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)?/g
  let total = 0
  let matched = ''
  let match: RegExpExecArray | null
  while ((match = pattern.exec(text)) !== null) {
    if (!match[0].trim()) break
    matched += match[0]
    const value = Number(match[1])
    // A bare number after hours means minutes ("1h30"); on its own, minutes too.
    const unit = match[2] ?? 'm'
    total += unit.startsWith('h') ? value * 3600 : unit.startsWith('s') ? value : value * 60
  }
  if (matched.replace(/\s/g, '') !== text.replace(/\s/g, '')) return null
  return total > 0 ? Math.round(total) : null
}

/** A countdown clock: "4:07", "12:00", "1:05:03". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`
}

/** A compact length for labels: "45 s", "10 min", "1 h 30 min". */
export function formatLength(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const parts: string[] = []
  if (h) parts.push(`${h} h`)
  if (m) parts.push(`${m} min`)
  if (s || parts.length === 0) parts.push(`${s} s`)
  return parts.join(' ')
}
