import { deriveTokens, type ThemeSeed, type Tokens } from './tokens'

export interface ThemePreset {
  id: string
  name: string
  seed: ThemeSeed
}

const DANGER = { l: 0.62, c: 0.19, h: 25 }
const WARN = { l: 0.75, c: 0.15, h: 75 }
const OK = { l: 0.68, c: 0.15, h: 150 }

/**
 * Phase 1 ships Light and Dark. The remaining presets land with the theme editor,
 * but they are plain seeds, so adding one is a five-line entry here.
 */
export const PRESETS: ThemePreset[] = [
  {
    id: 'dark',
    name: 'Dark',
    seed: {
      mode: 'dark',
      neutralHue: 265,
      neutralChroma: 0.012,
      accent: { l: 0.72, c: 0.16, h: 262 },
      danger: DANGER,
      warn: WARN,
      ok: OK,
    },
  },
  {
    id: 'light',
    name: 'Light',
    seed: {
      mode: 'light',
      neutralHue: 265,
      neutralChroma: 0.008,
      accent: { l: 0.55, c: 0.17, h: 262 },
      danger: { ...DANGER, l: 0.55 },
      warn: { ...WARN, l: 0.62 },
      ok: { ...OK, l: 0.55 },
    },
  },
  {
    id: 'dim',
    name: 'Dim',
    seed: {
      mode: 'dark',
      neutralHue: 230,
      neutralChroma: 0.02,
      accent: { l: 0.74, c: 0.13, h: 215 },
      danger: DANGER,
      warn: WARN,
      ok: OK,
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    seed: {
      mode: 'dark',
      neutralHue: 250,
      neutralChroma: 0.022,
      accent: { l: 0.78, c: 0.08, h: 220 },
      danger: { l: 0.65, c: 0.13, h: 20 },
      warn: { l: 0.82, c: 0.11, h: 80 },
      ok: { l: 0.78, c: 0.1, h: 145 },
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    seed: {
      mode: 'dark',
      neutralHue: 70,
      neutralChroma: 0.022,
      accent: { l: 0.76, c: 0.14, h: 95 },
      danger: { l: 0.62, c: 0.16, h: 30 },
      warn: { l: 0.79, c: 0.14, h: 80 },
      ok: { l: 0.75, c: 0.13, h: 130 },
    },
  },
  {
    id: 'solarized',
    name: 'Solarized',
    seed: {
      mode: 'light',
      neutralHue: 90,
      neutralChroma: 0.022,
      accent: { l: 0.55, c: 0.13, h: 230 },
      danger: { l: 0.55, c: 0.17, h: 25 },
      warn: { l: 0.62, c: 0.14, h: 70 },
      ok: { l: 0.58, c: 0.13, h: 140 },
    },
  },
  {
    id: 'amoled',
    name: 'AMOLED',
    seed: {
      mode: 'dark',
      // Chroma 0 with a near-black ramp: on an OLED panel a true black pixel is
      // switched off, so this theme genuinely saves power.
      neutralHue: 0,
      neutralChroma: 0,
      accent: { l: 0.75, c: 0.17, h: 195 },
      danger: DANGER,
      warn: WARN,
      ok: OK,
    },
  },
  {
    id: 'contrast',
    name: 'High contrast',
    seed: {
      mode: 'dark',
      neutralHue: 0,
      neutralChroma: 0,
      accent: { l: 0.85, c: 0.2, h: 90 },
      danger: { l: 0.72, c: 0.2, h: 25 },
      warn: { l: 0.88, c: 0.18, h: 85 },
      ok: { l: 0.82, c: 0.18, h: 150 },
    },
  },
]

/** AMOLED pushes its backgrounds to true black after the ramp is derived. */
const RAMP_OVERRIDES: Record<string, Record<string, string>> = {
  amoled: { bg: '#000000', 'bg-2': '#000000', surface: '#0a0a0a', 'surface-2': '#141414' },
  contrast: { bg: '#000000', 'bg-2': '#000000', text: '#ffffff', border: '#666666' },
}

export const PRESETS_BY_ID = new Map(PRESETS.map((p) => [p.id, p]))

export function presetTokens(id: string): Tokens | null {
  const preset = PRESETS_BY_ID.get(id)
  if (!preset) return null
  return { ...deriveTokens(preset.seed), ...(RAMP_OVERRIDES[id] ?? {}) }
}

/** Fallback used before settings load and when a stored theme id disappears. */
export const DEFAULT_THEME_ID = 'dark'

export function systemPrefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}
