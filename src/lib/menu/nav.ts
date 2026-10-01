/**
 * Keyboard movement inside a menu, kept pure so it can be unit-tested.
 *
 * Disabled items are skipped, movement wraps at both ends, and Home/End jump to
 * the first and last enabled item - the WAI-ARIA menu pattern.
 */
export interface NavItem {
  disabled?: boolean
}

export type NavKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End'

export function nextIndex(items: NavItem[], current: number, key: NavKey): number {
  const enabled = items.map((item, i) => (item.disabled ? -1 : i)).filter((i) => i >= 0)
  if (enabled.length === 0) return -1
  if (key === 'Home') return enabled[0]!
  if (key === 'End') return enabled[enabled.length - 1]!

  const step = key === 'ArrowDown' ? 1 : -1
  for (let n = 1; n <= items.length; n++) {
    const i = (((current + step * n) % items.length) + items.length) % items.length
    if (!items[i]!.disabled) return i
  }
  return current
}

/** Index of the first enabled item whose label starts with `char` after `current`. */
export function typeahead(items: (NavItem & { label: string })[], current: number, char: string): number {
  const needle = char.toLowerCase()
  for (let n = 1; n <= items.length; n++) {
    const i = (current + n) % items.length
    const item = items[i]!
    if (!item.disabled && item.label.toLowerCase().startsWith(needle)) return i
  }
  return current
}

/**
 * Places a menu of `size` near `anchor` inside a viewport, flipping above or to
 * the other side when it would overflow, and clamping as a last resort.
 */
export function placeMenu(
  anchor: { x: number; y: number; width?: number; height?: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8,
): { x: number; y: number } {
  const aw = anchor.width ?? 0
  const ah = anchor.height ?? 0
  let x = anchor.x
  let y = anchor.y + ah
  if (x + size.width > viewport.width - margin) x = anchor.x + aw - size.width
  if (y + size.height > viewport.height - margin && anchor.y - size.height >= margin) {
    y = anchor.y - size.height
  }
  x = Math.max(margin, Math.min(x, viewport.width - size.width - margin))
  y = Math.max(margin, Math.min(y, viewport.height - size.height - margin))
  return { x, y }
}
