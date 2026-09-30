import { shortId } from '$lib/utils/uuid'
import type { Section, TimerTab } from '../../routes/router'

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
  /** The area on screen: a navigation section, or the settings page. */
  section = $state<Section | 'settings'>('home')
  /** The settings page's open section id, e.g. 'appearance'. */
  settingsSection = $state<string | null>(null)
  /** The open tab of the timers section. */
  timersTab = $state<TimerTab>('alarms')
  /** The welcome tour is running. */
  tourOpen = $state(false)
  /** Which pane is visible on narrow screens. Ignored on wide layouts. */
  pane = $state<Pane>('list')
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

  #timers = new Map<string, { handle: ReturnType<typeof setTimeout>; remaining: number; started: number }>()

  toast(message: string, tone: Toast['tone'] = 'info', action?: Toast['action']): void {
    // The same message twice in a row (a double click, a retried save) is one toast.
    const duplicate = this.toasts.find((t) => t.message === message && t.tone === tone)
    if (duplicate) this.dismiss(duplicate.id)

    const toast: Toast = { id: shortId(), message, tone, action }
    // Never more than three: a burst of messages should not bury the page.
    this.toasts = [...this.toasts, toast].slice(-3)
    this.#arm(toast.id, action ? 8000 : 4000)
  }

  #arm(id: string, ms: number): void {
    this.#timers.set(id, {
      handle: setTimeout(() => this.dismiss(id), ms),
      remaining: ms,
      started: Date.now(),
    })
  }

  /** Hovering or focusing a toast holds it, so an Undo is not snatched away mid-reach. */
  holdToast(id: string): void {
    const timer = this.#timers.get(id)
    if (!timer) return
    clearTimeout(timer.handle)
    timer.remaining = Math.max(1500, timer.remaining - (Date.now() - timer.started))
  }

  releaseToast(id: string): void {
    const timer = this.#timers.get(id)
    if (timer) this.#arm(id, timer.remaining)
  }

  dismiss(id: string): void {
    const timer = this.#timers.get(id)
    if (timer) clearTimeout(timer.handle)
    this.#timers.delete(id)
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
