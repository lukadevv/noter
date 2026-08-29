/**
 * Fractional ordering: an item dropped between two neighbours takes the midpoint
 * of their `order` values, so a reorder writes one row instead of renumbering
 * the whole list.
 */
export const ORDER_STEP = 1000

/** Order for an item placed between `before` and `after` (either may be absent). */
export function orderBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) return ORDER_STEP
  if (before === null) return after! - ORDER_STEP
  if (after === null) return before + ORDER_STEP
  return (before + after) / 2
}

/** Order for appending to the end of a list already sorted by `order`. */
export function orderAfterLast(items: { order: number }[]): number {
  if (items.length === 0) return ORDER_STEP
  return Math.max(...items.map((i) => i.order)) + ORDER_STEP
}

/**
 * Doubles between two neighbours halve each time; after ~50 inserts in the same
 * gap float precision runs out. Callers rebalance the affected list when this
 * reports true.
 */
export function needsRebalance(order: number, before: number | null, after: number | null): boolean {
  const gap = Math.min(
    before === null ? Infinity : Math.abs(order - before),
    after === null ? Infinity : Math.abs(after - order),
  )
  return gap < 1e-6
}

/** Evenly respaced orders for a list, preserving its current sequence. */
export function rebalance<T>(items: T[]): (T & { order: number })[] {
  return items.map((item, i) => ({ ...item, order: (i + 1) * ORDER_STEP }))
}
