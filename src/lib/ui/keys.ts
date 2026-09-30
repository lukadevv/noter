/** True on macOS and iOS, where shortcuts use ⌘ instead of Ctrl. */
export function isApple(): boolean {
  if (typeof navigator === 'undefined') return false
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/**
 * Renders "Mod+Shift+K" as "⌘⇧K" on Apple platforms and "Ctrl+Shift+K"
 * elsewhere, so hints match the keyboard in front of the user.
 */
export function formatShortcut(keys: string, apple = isApple()): string {
  const parts = keys.split('+')
  if (apple) {
    const symbols: Record<string, string> = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃', Enter: '↩' }
    return parts.map((p) => symbols[p] ?? p).join('')
  }
  return parts.map((p) => (p === 'Mod' ? 'Ctrl' : p)).join('+')
}

/** True when the platform's primary modifier is held (⌘ on Apple, Ctrl elsewhere). */
export function modKey(event: KeyboardEvent | MouseEvent): boolean {
  return event.metaKey || event.ctrlKey
}
