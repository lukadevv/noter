/**
 * Fixed-height windowing for long lists.
 *
 * Uniform rows are a deliberate constraint: they make the scroll height exact
 * and the visible range a division rather than a measured layout pass, so the
 * list stays smooth at thousands of notes with no ResizeObserver bookkeeping.
 */
export interface VirtualRange {
  /** Index of the first rendered row. */
  start: number
  /** Index after the last rendered row. */
  end: number
  /** Spacer height above the rendered rows, in px. */
  padTop: number
  /** Spacer height below the rendered rows, in px. */
  padBottom: number
}

export function computeRange(
  count: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 6,
): VirtualRange {
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 }

  const firstVisible = Math.floor(Math.max(0, scrollTop) / rowHeight)
  const visibleCount = Math.ceil(Math.max(0, viewportHeight) / rowHeight) + 1

  const start = Math.max(0, firstVisible - overscan)
  const end = Math.min(count, firstVisible + visibleCount + overscan)

  return {
    start,
    end,
    padTop: start * rowHeight,
    padBottom: Math.max(0, (count - end) * rowHeight),
  }
}
