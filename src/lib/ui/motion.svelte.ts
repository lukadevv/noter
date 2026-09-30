/**
 * Motion, as one switch the whole app obeys.
 *
 * CSS transitions are governed by `data-motion` on <html> (see app.css), but
 * Svelte's `transition:` directives are driven from JavaScript and ignore CSS,
 * so every animated element uses the wrappers below instead of importing from
 * `svelte/transition` directly. They collapse to a fade when motion is reduced
 * and to nothing when it is off.
 */
import { fade, fly, scale, type TransitionConfig } from 'svelte/transition'
import { cubicOut } from 'svelte/easing'

export type MotionLevel = 'full' | 'reduced' | 'off'
export type MotionSetting = 'system' | MotionLevel

class Motion {
  level = $state<MotionLevel>('full')

  /** Resolves the user's setting against the OS preference. */
  apply(setting: MotionSetting): void {
    const prefersLess =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    this.level = setting === 'system' ? (prefersLess ? 'reduced' : 'full') : setting
    if (typeof document !== 'undefined') document.documentElement.dataset.motion = this.level
  }
}

export const motion = new Motion()

const NONE: TransitionConfig = { duration: 0 }

/** Dialogs, menus, popovers: a small scale-up from their origin. */
export function pop(node: Element, { duration = 140, start = 0.96 } = {}): TransitionConfig {
  if (motion.level === 'off') return NONE
  if (motion.level === 'reduced') return fade(node, { duration: 90 })
  return scale(node, { duration, start, opacity: 0, easing: cubicOut })
}

/** Toasts, cards, list rows: a short rise into place. */
export function rise(node: Element, { duration = 180, y = 8, delay = 0 } = {}): TransitionConfig {
  if (motion.level === 'off') return NONE
  if (motion.level === 'reduced') return fade(node, { duration: 90 })
  return fly(node, { duration, y, delay, opacity: 0, easing: cubicOut })
}

/** Panes and pages sliding in from the reading direction. */
export function slide(node: Element, { duration = 200, x = 24 } = {}): TransitionConfig {
  if (motion.level === 'off') return NONE
  if (motion.level === 'reduced') return fade(node, { duration: 90 })
  const rtl = document.documentElement.dir === 'rtl'
  return fly(node, { duration, x: rtl ? -x : x, opacity: 0, easing: cubicOut })
}

/** Backdrops and anything that should only change opacity. */
export function fadeIn(node: Element, { duration = 120 } = {}): TransitionConfig {
  if (motion.level === 'off') return NONE
  return fade(node, { duration: motion.level === 'reduced' ? 90 : duration })
}

/** Duration for `animate:flip` and similar, honouring the setting. */
export function flipDuration(ms = 180): number {
  return motion.level === 'full' ? ms : 0
}
