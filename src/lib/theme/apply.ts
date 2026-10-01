import type { Tokens } from './tokens'
import type { Density, FontChoice } from '$lib/db/repo/settings'

/** Spacing multiplier per density setting; every --space-* token scales by it. */
const DENSITY_SCALE: Record<Density, string> = {
  compact: '0.82',
  cozy: '1',
  comfortable: '1.18',
}

const FONT_STACKS: Record<FontChoice, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  sans: 'Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
}

export interface ChromeOptions {
  density: Density
  font: FontChoice
  editorFontSize: number
  radiusScale: number
}

/** Writes colour tokens onto an element as CSS custom properties. */
export function applyTokens(tokens: Tokens, target: HTMLElement = document.documentElement): void {
  for (const [key, value] of Object.entries(tokens)) {
    if (key === 'color-scheme') target.style.colorScheme = value
    else target.style.setProperty(`--${key}`, value)
  }
}

/** The tokens a folder's accent colour overrides. */
export const ACCENT_KEYS = ['accent', 'accent-hover', 'accent-active', 'accent-soft', 'accent-contrast']

/**
 * An inline style that puts the theme's own accent back inside an element, so a
 * folder's tint stops at it. Used by the navigation, which always shows the
 * app's colour.
 */
export function accentStyle(tokens: Tokens): string {
  return ACCENT_KEYS.filter((key) => tokens[key])
    .map((key) => `--${key}: ${tokens[key]}`)
    .join('; ')
}

/** Removes previously applied token overrides (used when leaving a tinted folder). */
export function clearTokens(keys: string[], target: HTMLElement): void {
  for (const key of keys) target.style.removeProperty(`--${key}`)
}

export function applyChrome(options: ChromeOptions, target: HTMLElement = document.documentElement): void {
  target.style.setProperty('--density', DENSITY_SCALE[options.density])
  target.style.setProperty('--font-ui', FONT_STACKS[options.font])
  target.style.setProperty('--font-mono', FONT_STACKS.mono)
  target.style.setProperty('--editor-font-size', `${options.editorFontSize}px`)
  target.style.setProperty('--radius-scale', String(options.radiusScale))
}
