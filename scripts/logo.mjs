/**
 * The Noter mark, as code: a squircle in the brand gradient holding three
 * rounded bars (blocks of a note) and a dot at the end of the last one (the
 * cursor). Kept as a module so the SVG source, every raster icon and the inline
 * sidebar mark are all drawn from the same numbers.
 */

export const BRAND_TOP = '#a29fff'
export const BRAND_BOTTOM = '#5550da'
export const CURSOR = '#ffc857'

/** A superellipse (n = 5) path filling a `size` box — softer than a rounded rect. */
export function squirclePath(size, inset = 0) {
  const r = size / 2 - inset
  const c = size / 2
  const n = 5
  const points = []
  const steps = 96
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    const cos = Math.cos(t)
    const sin = Math.sin(t)
    const x = c + r * Math.sign(cos) * Math.abs(cos) ** (2 / n)
    const y = c + r * Math.sign(sin) * Math.abs(sin) ** (2 / n)
    points.push(`${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return `M${points.join('L')}Z`
}

/**
 * The bars and the dot on a 1024 grid. `scale` shrinks them around the centre,
 * for full-bleed and adaptive icons whose safe zone is smaller than the tile.
 */
export function glyph({ scale = 1, bar = '#ffffff', dot = CURSOR } = {}) {
  const t = (v) => (512 + (v - 512) * scale).toFixed(1)
  const w = (96 * scale).toFixed(1)
  const bars = [
    [272, 372, 676],
    [272, 512, 544],
    [272, 652, 608],
  ]
  const lines = bars
    .map(([x1, y, x2]) => `<line x1="${t(x1)}" y1="${t(y)}" x2="${t(x2)}" y2="${t(y)}"/>`)
    .join('')
  return (
    `<g stroke="${bar}" stroke-width="${w}" stroke-linecap="round">${lines}</g>` +
    `<circle cx="${t(742)}" cy="${t(652)}" r="${(58 * scale).toFixed(1)}" fill="${dot}"/>`
  )
}

function gradient(id) {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="0.35" y2="1">` +
    `<stop offset="0" stop-color="${BRAND_TOP}"/><stop offset="1" stop-color="${BRAND_BOTTOM}"/>` +
    `</linearGradient>`
  )
}

/** The logo as drawn: transparent corners around the squircle tile. */
export function logoSvg() {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">` +
    `<defs>${gradient('g')}</defs>` +
    `<path d="${squirclePath(1024, 24)}" fill="url(#g)"/>` +
    glyph() +
    `</svg>`
  )
}

/** Gradient to the edges with the glyph inset; platforms apply their own mask. */
export function fullBleedSvg(scale = 0.8) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">` +
    `<defs>${gradient('g')}</defs>` +
    `<rect width="1024" height="1024" fill="url(#g)"/>` +
    glyph({ scale }) +
    `</svg>`
  )
}

/** Just the glyph on transparency, for Android's adaptive foreground layer. */
export function foregroundSvg(scale = 0.6) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${glyph({ scale })}</svg>`
}

/** The logo centred on a wide transparent canvas (Store tiles, splash screen). */
export function wideSvg(width, height, logoSize) {
  const x = (width - logoSize) / 2
  const y = (height - logoSize) / 2
  const s = logoSize / 1024
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">` +
    `<defs>${gradient('g')}</defs>` +
    `<g transform="translate(${x} ${y}) scale(${s})">` +
    `<path d="${squirclePath(1024, 24)}" fill="url(#g)"/>${glyph()}</g>` +
    `</svg>`
  )
}
