/**
 * Lays Home's widgets out on a 12-column grid without holes.
 *
 * Each widget has a preferred width. Widgets fill rows in the user's order;
 * when the next one does not fit, the last widget of the row stretches to the
 * edge. So "Recent notes" beside "Pinned" shares a row, and the same "Recent
 * notes" with Pinned hidden spans the whole width instead of leaving a gap.
 */
export const COLUMNS = 12

export function packRows<T extends string>(ids: T[], preferred: (id: T) => number): Map<T, number> {
  const spans = new Map<T, number>()
  let used = 0
  let last: T | null = null
  const close = () => {
    if (last !== null && used < COLUMNS) spans.set(last, (spans.get(last) ?? 0) + COLUMNS - used)
    used = 0
    last = null
  }
  for (const id of ids) {
    const span = Math.min(COLUMNS, Math.max(1, preferred(id)))
    if (used + span > COLUMNS) close()
    spans.set(id, span)
    used += span
    last = id
    if (used === COLUMNS) close()
  }
  close()
  return spans
}
