/** Shared UI types. Kept out of the components so `.svelte` files stay importable
 *  without pulling a component in just for a type. */

/** Where a dragged item lands relative to the row it was dropped on. */
export type DropPosition = 'before' | 'inside' | 'after'

export interface MenuItem {
  label: string
  icon?: string
  danger?: boolean
  separatorBefore?: boolean
  run: () => void
}
