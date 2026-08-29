import { describe, expect, it } from 'vitest'
import { contrastRatio, hexToOklch, oklchToHex, readableOn, toGamut } from '$lib/theme/oklch'

describe('oklch conversion', () => {
  it('round-trips a colour through hex', () => {
    const original = { l: 0.62, c: 0.14, h: 262 }
    const back = hexToOklch(oklchToHex(original))!
    expect(back.l).toBeCloseTo(original.l, 2)
    expect(back.c).toBeCloseTo(original.c, 2)
    expect(back.h).toBeCloseTo(original.h, 0)
  })

  it('maps the extremes to black and white', () => {
    expect(oklchToHex({ l: 0, c: 0, h: 0 })).toBe('#000000')
    expect(oklchToHex({ l: 1, c: 0, h: 0 })).toBe('#ffffff')
  })

  it('reduces chroma instead of clipping when out of gamut', () => {
    const wild = { l: 0.6, c: 0.4, h: 150 }
    const fitted = toGamut(wild)
    expect(fitted.c).toBeLessThan(wild.c)
    expect(fitted.l).toBe(wild.l)
    expect(fitted.h).toBe(wild.h)
  })

  it('preserves hue when fitting to gamut', () => {
    const hue = 29
    const fitted = toGamut({ l: 0.5, c: 0.35, h: hue })
    expect(hexToOklch(oklchToHex(fitted))!.h).toBeCloseTo(hue, 0)
  })
})

describe('contrast', () => {
  it('computes the WCAG range', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  })

  it('picks the readable foreground', () => {
    expect(readableOn('#ffffff')).toBe('#000000')
    expect(readableOn('#101014')).toBe('#ffffff')
  })
})
