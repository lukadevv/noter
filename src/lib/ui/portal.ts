/**
 * Moves an element to the end of <body>.
 *
 * Fixed-position overlays break inside any ancestor with a transform, filter or
 * contain rule, and inherit that ancestor's stacking context. Portalling them
 * out is the only reliable fix.
 */
export function portal(node: HTMLElement): { destroy(): void } {
  document.body.appendChild(node)
  return {
    destroy() {
      node.remove()
    },
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** The focusable descendants of an element, in tab order. */
export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !el.hasAttribute('inert') && el.getClientRects().length > 0,
  )
}

/**
 * Keeps Tab inside a dialog, focuses its first control on open and gives focus
 * back to whatever opened it on close.
 */
export function trapFocus(node: HTMLElement): { destroy(): void } {
  const previous = document.activeElement as HTMLElement | null
  queueMicrotask(() => {
    if (node.contains(document.activeElement)) return
    const target = node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables(node)[0] ?? node
    target.focus({ preventScroll: true })
  })

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab') return
    const items = focusables(node)
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0]!
    const last = items[items.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  node.addEventListener('keydown', onKeydown)
  return {
    destroy() {
      node.removeEventListener('keydown', onKeydown)
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    },
  }
}
