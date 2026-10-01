import { uiSound } from '$lib/audio/ui-sounds'
import type { MenuItem } from '$lib/ui-types'

export interface MenuAnchor {
  x: number
  y: number
  width?: number
  height?: number
}

interface OpenMenu {
  items: MenuItem[]
  anchor: MenuAnchor
  label?: string
  /** Element to give focus back to when the menu closes. */
  returnFocus: HTMLElement | null
}

/**
 * The single context menu of the app.
 *
 * Every "…" button and every right-click opens the same component through this
 * store, which is rendered once at the root: it can never be trapped under a
 * dialog or clipped by a transformed parent, and two menus cannot be open.
 */
class MenuStore {
  current = $state<OpenMenu | null>(null)

  /**
   * Opens a menu at a point (a right-click) or below an element (a button).
   * An empty item list is a no-op, so callers can build conditionally.
   */
  open(items: MenuItem[], at: MenuAnchor | HTMLElement, label?: string): void {
    if (items.length === 0) return
    const anchor =
      at instanceof HTMLElement
        ? (() => {
            const rect = at.getBoundingClientRect()
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height + 4 }
          })()
        : at
    const active = document.activeElement
    uiSound.play('menu')
    this.current = {
      items,
      anchor,
      label,
      returnFocus: at instanceof HTMLElement ? at : active instanceof HTMLElement ? active : null,
    }
  }

  close(restoreFocus = true): void {
    const previous = this.current
    this.current = null
    if (restoreFocus && previous?.returnFocus?.isConnected) {
      previous.returnFocus.focus({ preventScroll: true })
    }
  }
}

export const menu = new MenuStore()
