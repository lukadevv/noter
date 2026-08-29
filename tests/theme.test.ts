import { describe, expect, it } from 'vitest'
import { PRESETS, presetTokens } from '$lib/theme/presets'
import { deriveAccentTokens } from '$lib/theme/tokens'
import { contrastRatio } from '$lib/theme/oklch'

const REQUIRED = [
  'bg',
  'surface',
  'surface-2',
  'text',
  'text-dim',
  'border',
  'accent',
  'accent-contrast',
  'danger',
  'warn',
  'ok',
]

describe('theme presets', () => {
  it('derive every token the stylesheet relies on', () => {
    for (const preset of PRESETS) {
      const tokens = presetTokens(preset.id)!
      for (const key of REQUIRED) {
        expect(tokens[key], `${preset.id} is missing --${key}`).toBeDefined()
      }
    }
  })

  it('meet WCAG AA for body text on the page background', () => {
    for (const preset of PRESETS) {
      const tokens = presetTokens(preset.id)!
      expect(contrastRatio(tokens.text!, tokens.bg!), `${preset.id} body text`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keep accent labels legible on the accent fill', () => {
    for (const preset of PRESETS) {
      const tokens = presetTokens(preset.id)!
      expect(
        contrastRatio(tokens['accent-contrast']!, tokens.accent!),
        `${preset.id} accent label`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('returns null for an unknown preset id', () => {
    expect(presetTokens('nope')).toBeNull()
  })

  it('derives only accent tokens for per-folder overrides', () => {
    const tokens = deriveAccentTokens({ l: 0.7, c: 0.15, h: 30 }, 'dark')
    expect(Object.keys(tokens).sort()).toEqual([
      'accent',
      'accent-active',
      'accent-contrast',
      'accent-hover',
      'accent-soft',
    ])
  })
})
