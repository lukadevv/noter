import type { MenuItem } from '$lib/ui-types'
import { menu } from '$lib/stores/menu.svelte'

const LONG_PRESS_MS = 500
const MOVE_TOLERANCE = 10

/**
 * Opens the app's context menu on right-click, on a touch long-press and on
 * Shift+F10 / the Menu key - the three ways people ask for "more options".
 *
 *   <div use:contextmenu={() => folderMenuItems(folder)}>
 *
 * Items are built lazily, when the menu opens, so rows do not pay for menus
 * nobody opens. Returning an empty list leaves the native menu alone.
 */
export function contextmenu(
  node: HTMLElement,
  build: () => MenuItem[],
): { update(next: () => MenuItem[]): void; destroy(): void } {
  let items = build
  let timer: ReturnType<typeof setTimeout> | null = null
  let start: { x: number; y: number } | null = null
  /** Set after a long-press opened the menu, to eat the click and native menu that follow. */
  let suppress = false

  function openAt(x: number, y: number): boolean {
    const list = items()
    if (list.length === 0) return false
    menu.open(list, { x, y })
    return true
  }

  function onContextMenu(event: MouseEvent) {
    if (suppress) {
      // Android fires its own contextmenu after a long-press we already handled.
      event.preventDefault()
      return
    }
    // Keyboard-triggered (Shift+F10, Menu key) events report (0, 0): anchor to the element.
    const fromKeyboard = event.clientX === 0 && event.clientY === 0
    const rect = node.getBoundingClientRect()
    const x = fromKeyboard ? rect.left + 12 : event.clientX
    const y = fromKeyboard ? rect.top + rect.height / 2 : event.clientY
    if (openAt(x, y)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }

  function cancel() {
    if (timer) clearTimeout(timer)
    timer = null
    start = null
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType !== 'touch') return
    start = { x: event.clientX, y: event.clientY }
    timer = setTimeout(() => {
      if (!start) return
      if (openAt(start.x, start.y)) {
        suppress = true
        navigator.vibrate?.(10)
        setTimeout(() => (suppress = false), 700)
      }
      cancel()
    }, LONG_PRESS_MS)
  }

  function onPointerMove(event: PointerEvent) {
    if (!start) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_TOLERANCE) cancel()
  }

  function onClick(event: MouseEvent) {
    if (!suppress) return
    event.preventDefault()
    event.stopPropagation()
  }

  node.addEventListener('contextmenu', onContextMenu)
  node.addEventListener('pointerdown', onPointerDown)
  node.addEventListener('pointermove', onPointerMove)
  node.addEventListener('pointerup', cancel)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('click', onClick, true)

  return {
    update(next) {
      items = next
    },
    destroy() {
      cancel()
      node.removeEventListener('contextmenu', onContextMenu)
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', cancel)
      node.removeEventListener('pointercancel', cancel)
      node.removeEventListener('click', onClick, true)
    },
  }
}
