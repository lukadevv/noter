/**
 * Generates the PWA icons.
 *
 * They are drawn here rather than committed as binaries so the mark stays in
 * sync with the theme's accent and can be regenerated from one source of truth.
 * Only zlib is needed: PNG is a handful of length-prefixed, CRC'd chunks.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../public/icons')

const ACCENT_TOP = [0x9b, 0x9c, 0xf2]
const ACCENT_BOTTOM = [0x6d, 0x6e, 0xd6]
const INK = [0x14, 0x14, 0x19]

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type: RGBA
  // Every row is prefixed with filter type 0 (None); the image is tiny enough
  // that smarter filtering would not pay for itself.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance from a point to a rounded rectangle centred at the origin. */
function roundedRectDistance(px, py, halfW, halfH, radius) {
  const qx = Math.abs(px) - halfW + radius
  const qy = Math.abs(py) - halfH + radius
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius
}

function draw(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2

  // Maskable icons are cropped to a circle by the launcher, so the artwork is
  // full-bleed and the glyph shrinks into the 80% safe zone.
  const plateRadius = maskable ? 0 : size * 0.22
  const plateHalf = size / 2
  const glyphScale = maskable ? 0.56 : 0.66

  const pageHalfW = (size * glyphScale) / 2.6
  const pageHalfH = (size * glyphScale) / 2
  const pageRadius = size * 0.035
  const lineHeight = size * 0.045
  const lineRadius = lineHeight / 2

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5 - cx
      const py = y + 0.5 - cy

      const plate = plateRadius > 0
        ? roundedRectDistance(px, py, plateHalf, plateHalf, plateRadius)
        : -1
      const plateAlpha = Math.min(Math.max(0.5 - plate, 0), 1)

      const t = y / size
      let r = ACCENT_TOP[0] + (ACCENT_BOTTOM[0] - ACCENT_TOP[0]) * t
      let g = ACCENT_TOP[1] + (ACCENT_BOTTOM[1] - ACCENT_TOP[1]) * t
      let b = ACCENT_TOP[2] + (ACCENT_BOTTOM[2] - ACCENT_TOP[2]) * t

      // Page outline, then three text lines, punched in ink over the accent.
      const page = roundedRectDistance(px, py, pageHalfW, pageHalfH, pageRadius)
      const pageStroke = Math.abs(page) - size * 0.028
      let inkAlpha = Math.min(Math.max(0.5 - pageStroke, 0), 1)

      for (let i = 0; i < 3; i++) {
        const ly = py - (i - 1) * size * 0.13
        const lw = pageHalfW * (i === 2 ? 0.42 : 0.62)
        const line = roundedRectDistance(px, ly, lw, lineRadius, lineRadius)
        inkAlpha = Math.max(inkAlpha, Math.min(Math.max(0.5 - line, 0), 1))
      }

      r += (INK[0] - r) * inkAlpha
      g += (INK[1] - g) * inkAlpha
      b += (INK[2] - b) * inkAlpha

      const offset = (y * size + x) * 4
      rgba[offset] = Math.round(r)
      rgba[offset + 1] = Math.round(g)
      rgba[offset + 2] = Math.round(b)
      rgba[offset + 3] = Math.round(plateAlpha * 255)
    }
  }

  return encodePng(size, rgba)
}

mkdirSync(OUT_DIR, { recursive: true })

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-512.png', size: 512, maskable: true },
]

for (const target of targets) {
  const png = draw(target.size, { maskable: target.maskable })
  writeFileSync(resolve(OUT_DIR, target.file), png)
  console.log(`wrote icons/${target.file} (${png.length} bytes)`)
}
