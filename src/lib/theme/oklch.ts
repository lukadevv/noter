/**
 * Minimal OKLCH colour maths.
 *
 * OKLCH is used instead of HSL because its lightness axis is perceptually
 * uniform: a whole surface/border/text scale can be derived from one base by
 * moving L in even steps, and the steps look even in every hue. In HSL the same
 * arithmetic produces scales that are muddy in yellow and washed out in blue.
 */

export interface Oklch {
  /** Perceptual lightness, 0..1. */
  l: number
  /** Chroma, 0..~0.37 in sRGB. */
  c: number
  /** Hue angle in degrees. */
  h: number
}

export interface Rgb {
  r: number
  g: number
  b: number
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)

function gammaEncode(x: number): number {
  return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055
}

function gammaDecode(x: number): number {
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
}

/** OKLCH to linear-light sRGB. Components may fall outside 0..1 (out of gamut). */
export function oklchToLinearRgb({ l, c, h }: Oklch): Rgb {
  const hRad = (h * Math.PI) / 180
  const a = c * Math.cos(hRad)
  const b = c * Math.sin(hRad)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const L = l_ * l_ * l_
  const M = m_ * m_ * m_
  const S = s_ * s_ * s_

  return {
    r: 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    g: -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    b: -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  }
}

function inGamut({ r, g, b }: Rgb, epsilon = 1e-4): boolean {
  return (
    r >= -epsilon && r <= 1 + epsilon && g >= -epsilon && g <= 1 + epsilon && b >= -epsilon && b <= 1 + epsilon
  )
}

/**
 * Pulls a colour into the sRGB gamut by reducing chroma while holding lightness
 * and hue. Clipping RGB directly would shift the hue instead.
 */
export function toGamut(color: Oklch): Oklch {
  if (inGamut(oklchToLinearRgb(color))) return color
  let lo = 0
  let hi = color.c
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (inGamut(oklchToLinearRgb({ ...color, c: mid }))) lo = mid
    else hi = mid
  }
  return { ...color, c: lo }
}

export function oklchToHex(color: Oklch): string {
  const linear = oklchToLinearRgb(toGamut(color))
  const to255 = (x: number) => Math.round(clamp01(gammaEncode(x)) * 255)
  const hex = (x: number) => x.toString(16).padStart(2, '0')
  return `#${hex(to255(linear.r))}${hex(to255(linear.g))}${hex(to255(linear.b))}`
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  let body = m[1]!
  if (body.length === 3) body = body.split('').map((ch) => ch + ch).join('')
  return {
    r: parseInt(body.slice(0, 2), 16) / 255,
    g: parseInt(body.slice(2, 4), 16) / 255,
    b: parseInt(body.slice(4, 6), 16) / 255,
  }
}

/** sRGB hex to OKLCH, for reading colours out of a colour input. */
export function hexToOklch(hex: string): Oklch | null {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const r = gammaDecode(rgb.r)
  const g = gammaDecode(rgb.g)
  const b = gammaDecode(rgb.b)

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const c = Math.sqrt(a * a + bb * bb)
  let h = (Math.atan2(bb, a) * 180) / Math.PI
  if (h < 0) h += 360
  return { l, c, h }
}

/** WCAG relative luminance of an sRGB hex colour. */
export function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0
  const r = gammaDecode(rgb.r)
  const g = gammaDecode(rgb.g)
  const b = gammaDecode(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio between two sRGB hex colours, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const light = Math.max(la, lb)
  const dark = Math.min(la, lb)
  return (light + 0.05) / (dark + 0.05)
}

/** Black or white, whichever reads better on the given background. */
export function readableOn(hex: string): string {
  return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000') ? '#ffffff' : '#000000'
}
