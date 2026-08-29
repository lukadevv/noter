import { shortId } from '$lib/utils/uuid'

export type Pane = 'folders' | 'list' | 'note'

export interface Toast {
  id: string
  message: string
  tone: 'info' | 'ok' | 'warn' | 'danger'
  /** Optional single action, e.g. "Undo". */
  action?: { label: string; run: () => void }
}

/** Below this width the three panes become a single-pane stack. */
export const MOBILE_BREAKPOINT = 860

class UiStore {
  /** Which pane is visible on narrow screens. Ignored on wide layouts. */
  pane = $state<Pane>('list')
  sidebarCollapsed = $state(false)
  narrow = $state(false)
  toasts = $state<Toast[]>([])
  /** Set while a drag is in flight so drop targets can light up. */
  dragging = $state<{ kind: 'note' | 'folder'; id: string } | null>(null)

  showPane(pane: Pane): void {
    this.pane = pane
  }

  /** On narrow layouts, going "back" walks note -> list -> folders. */
  back(): void {
    if (this.pane === 'note') this.pane = 'list'
    else if (this.pane === 'list') this.pane = 'folders'
  }

  toast(message: string, tone: Toast['tone'] = 'info', action?: Toast['action']): void {
    const toast: Toast = { id: shortId(), message, tone, action }
    this.toasts = [...this.toasts, toast]
    setTimeout(() => this.dismiss(toast.id), action ? 8000 : 4000)
  }

  dismiss(id: string): void {
    this.toasts = this.toasts.filter((t) => t.id !== id)
  }

  /** Keeps `narrow` in sync with the viewport. Returns an unsubscribe function. */
  watchViewport(): () => void {
    const query = matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`)
    const update = () => {
      this.narrow = query.matches
    }
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }
}

export const ui = new UiStore()
