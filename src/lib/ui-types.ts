/** Shared UI types. Kept out of the components so `.svelte` files stay importable
 *  without pulling a component in just for a type. */

/** Where a dragged item lands relative to the row it was dropped on. */
export type DropPosition = 'before' | 'inside' | 'after'

export interface MenuItem {
  label: string
  /** Stable key; falls back to the index. Labels are not unique (two folders can share a name). */
  id?: string
  icon?: string
  danger?: boolean
  separatorBefore?: boolean
  disabled?: boolean
  /** Shows a check mark: the item is the current choice. */
  checked?: boolean
  /** A shortcut hint in "Mod+Shift+K" form. */
  shortcut?: string
  /** Opens a nested menu instead of running. */
  submenu?: MenuItem[]
  run?: () => void
}
