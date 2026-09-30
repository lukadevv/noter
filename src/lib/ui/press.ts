import { motion } from './motion.svelte'

/**
 * A soft ripple from the point of contact: the "yes, that registered" a tap
 * needs on a surface that has no hover state to speak of (phones, tiles).
 *
 * The host must be `position: relative` with `overflow: hidden`; the ripple
 * takes `currentColor`, so it matches whatever the button's text is.
 */
export function press(node: HTMLElement): { destroy(): void } {
  function onDown(event: PointerEvent) {
    if (motion.level !== 'full' || event.button !== 0) return
    const rect = node.getBoundingClientRect()
    const size = Math.hypot(rect.width, rect.height) * 2
    const ripple = document.createElement('span')
    ripple.className = 'press-ripple'
    ripple.style.width = ripple.style.height = `${size}px`
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`
    node.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true })
  }
  node.addEventListener('pointerdown', onDown)
  return {
    destroy() {
      node.removeEventListener('pointerdown', onDown)
    },
  }
}
