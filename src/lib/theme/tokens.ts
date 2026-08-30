import { oklchToHex, readableOn, type Oklch } from './oklch'

/**
 * A theme is a flat map of CSS custom properties. Every rule in the app reads
 * from these names and nothing else, which is what makes runtime theming and
 * per-folder accents possible without touching component styles.
 */
export type Tokens = Record<string, string>

/**
 * The compact description a user actually edits. The ~30 colour tokens are
 * derived from it, so a custom theme is five pickers rather than thirty.
 */
export interface ThemeSeed {
  mode: 'light' | 'dark'
  /** Hue of the greys, in degrees. A slight tint reads far better than pure grey. */
  neutralHue: number
  /** Chroma of the greys. 0 is neutral; 0.01-0.03 gives a tinted, warmer surface. */
  neutralChroma: number
  accent: Oklch
  danger: Oklch
  warn: Oklch
  ok: Oklch
}

/** Lightness ramps, ordered from page background to primary text. */
const RAMP = {
  dark: {
    bg: 0.17,
    bg2: 0.14,
    surface: 0.21,
    surface2: 0.25,
    surface3: 0.29,
    border: 0.31,
    borderStrong: 0.4,
    textFaint: 0.55,
    textDim: 0.72,
    text: 0.95,
  },
  light: {
    bg: 0.975,
    bg2: 0.95,
    surface: 1,
    surface2: 0.965,
    surface3: 0.93,
    border: 0.9,
    borderStrong: 0.82,
    textFaint: 0.62,
    textDim: 0.48,
    text: 0.24,
  },
} as const

const neutral = (seed: ThemeSeed, l: number): string =>
  oklchToHex({ l, c: seed.neutralChroma, h: seed.neutralHue })

/** Mixes a colour towards the page background, for soft/tinted fills. */
function soften(color: Oklch, seed: ThemeSeed, amount: number): string {
  const ramp = RAMP[seed.mode]
  return oklchToHex({
    l: color.l + (ramp.bg - color.l) * amount,
    c: color.c * (1 - amount * 0.75),
    h: color.h,
  })
}

export function deriveTokens(seed: ThemeSeed): Tokens {
  const ramp = RAMP[seed.mode]
  const dir = seed.mode === 'dark' ? 1 : -1
  const accentHex = oklchToHex(seed.accent)

  return {
    'color-scheme': seed.mode,

    bg: neutral(seed, ramp.bg),
    'bg-2': neutral(seed, ramp.bg2),
    surface: neutral(seed, ramp.surface),
    'surface-2': neutral(seed, ramp.surface2),
    'surface-3': neutral(seed, ramp.surface3),

    text: neutral(seed, ramp.text),
    'text-dim': neutral(seed, ramp.textDim),
    'text-faint': neutral(seed, ramp.textFaint),

    border: neutral(seed, ramp.border),
    'border-strong': neutral(seed, ramp.borderStrong),

    accent: accentHex,
    'accent-hover': oklchToHex({ ...seed.accent, l: seed.accent.l + 0.06 * dir }),
    'accent-active': oklchToHex({ ...seed.accent, l: seed.accent.l - 0.04 * dir }),
    'accent-soft': soften(seed.accent, seed, 0.82),
    'accent-contrast': readableOn(accentHex),

    danger: oklchToHex(seed.danger),
    'danger-soft': soften(seed.danger, seed, 0.84),
    warn: oklchToHex(seed.warn),
    'warn-soft': soften(seed.warn, seed, 0.84),
    ok: oklchToHex(seed.ok),
    'ok-soft': soften(seed.ok, seed, 0.84),

    /** Backdrop behind modals; alpha keeps the page readable underneath. */
    overlay: seed.mode === 'dark' ? 'rgba(0, 0, 0, 0.55)' : 'rgba(20, 20, 24, 0.35)',
    'shadow-1': seed.mode === 'dark' ? '0 1px 2px rgba(0,0,0,.4)' : '0 1px 2px rgba(16,18,24,.08)',
    'shadow-2':
      seed.mode === 'dark'
        ? '0 8px 24px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35)'
        : '0 8px 24px rgba(16,18,24,.12), 0 2px 6px rgba(16,18,24,.06)',
  }
}

/** Recomputes only the accent-family tokens, for per-folder accent overrides. */
export function deriveAccentTokens(accent: Oklch, mode: 'light' | 'dark'): Tokens {
  const seed: ThemeSeed = {
    mode,
    neutralHue: accent.h,
    neutralChroma: 0,
    accent,
    danger: accent,
    warn: accent,
    ok: accent,
  }
  const all = deriveTokens(seed)
  const keys = ['accent', 'accent-hover', 'accent-active', 'accent-soft', 'accent-contrast']
  return Object.fromEntries(keys.map((k) => [k, all[k]!]))
}
