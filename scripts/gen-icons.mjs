/**
 * Generates every icon and social image from one source logo.
 *
 * The source (`assets/logo.png`) is the only artwork kept by hand; everything
 * under `public/` is derived and committed, so a clone needs no image tooling to
 * build. Regenerating does need ImageMagick, which is why the script checks for
 * it up front and says so plainly.
 *
 * Two families come out of this:
 *
 *  - **Transparent, rounded** — the logo as drawn. Favicons and the PWA's
 *    `purpose: any` icons, which sit on backgrounds we do not control.
 *  - **Full-bleed square** — the logo over a matching gradient that fills the
 *    corners. Android crops maskable icons to its own shape and iOS applies its
 *    own rounding, so an icon with rounded corners of its own gets clipped
 *    twice and ends up visibly smaller than its neighbours.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(ROOT, 'assets/logo.png')
const PUBLIC = join(ROOT, 'public')
const ICONS = join(PUBLIC, 'icons')

/** Sampled from the top and bottom of the logo, so the fill matches its gradient. */
const GRADIENT_TOP = '#9494fb'
const GRADIENT_BOTTOM = '#5f5be0'
/** The app's dark background, so the social card matches the product. */
const CARD_BACKGROUND = '#17171c'
const CARD_TEXT = '#edecf2'
const CARD_MUTED = '#a8a6b4'
const TAGLINE = 'Local-first notes that work offline'

function run(args) {
  return execFileSync('convert', args, { encoding: 'utf8' })
}

function requireImageMagick() {
  try {
    execFileSync('convert', ['-version'], { stdio: 'ignore' })
  } catch {
    console.error(
      [
        '',
        '  ImageMagick is required to regenerate the icons.',
        '',
        '    Debian/Ubuntu:  sudo apt install imagemagick',
        '    macOS:          brew install imagemagick',
        '',
        '  The generated files are committed, so this is only needed when the',
        '  logo itself changes.',
        '',
      ].join('\n'),
    )
    process.exit(1)
  }
}

/** A font for the social card's wordmark, or null when none is installed. */
function findFont() {
  for (const candidate of ['DejaVu-Sans-Bold', 'FreeSans-Bold', 'Helvetica-Bold', 'Nimbus-Sans-Bold']) {
    try {
      const list = execFileSync('convert', ['-list', 'font'], { encoding: 'utf8' })
      if (list.includes(`Font: ${candidate}`)) return candidate
    } catch {
      return null
    }
  }
  return null
}

/** The logo at `size`, keeping its transparent corners. */
function transparent(size, output) {
  run([SOURCE, '-resize', `${size}x${size}`, '-strip', output])
}

/**
 * Reads one pixel as `[r, g, b]`, 0-255.
 *
 * The alpha channel is left on: with `-alpha off` this artwork reports every
 * pixel as black, because the stored colour channels are premultiplied.
 */
function samplePixel(x, y) {
  const value = execFileSync('convert', [SOURCE, '-format', `%[pixel:p{${x},${y}}]`, 'info:'], {
    encoding: 'utf8',
  })
  const match = /\(?([\d.]+)%?,\s*([\d.]+)%?,\s*([\d.]+)%?/.exec(value)
  if (!match) throw new Error(`Could not read pixel ${x},${y}: ${value}`)

  const percent = value.includes('%')
  return match.slice(1, 4).map((n) => Math.round((Number(n) / (percent ? 100 : 255)) * 255))
}

/**
 * Vertical extent of the artwork, as a fraction of the source canvas.
 *
 * Measured from the alpha of the centre column rather than with `-trim`: the
 * export carries faint near-transparent speckles in the corners, and trim treats
 * those as content, reporting a shape that fills almost the whole canvas.
 */
function shapeExtent() {
  const size = parseInt(execFileSync('identify', ['-format', '%h', SOURCE], { encoding: 'utf8' }), 10)
  const middle = Math.round(size / 2)

  const column = execFileSync(
    'convert',
    [SOURCE, '-alpha', 'extract', '-crop', `1x${size}+${middle}+0`, '+repage', '-depth', '8', 'txt:-'],
    { encoding: 'utf8' },
  )

  const opaque = []
  for (const line of column.split('\n').slice(1)) {
    const match = /^0,(\d+):\s*\((\d+)/.exec(line)
    if (match && Number(match[2]) > 250) opaque.push(Number(match[1]))
  }
  if (opaque.length === 0) throw new Error('The logo appears to be fully transparent')

  const top = Math.min(...opaque)
  const bottom = Math.max(...opaque)
  return { top: top / size, bottom: (bottom + 1) / size, size, topPx: top, bottomPx: bottom }
}

function hex([r, g, b]) {
  return `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The logo on a full-bleed square, for maskable and iOS icons.
 *
 * Those platforms apply their own mask, so an icon that also has rounded corners
 * of its own is clipped twice and ends up visibly smaller than its neighbours.
 *
 * The corners are filled by *extending the logo's own gradient* rather than by
 * inventing a background. A gradient drawn across the canvas does not line up
 * with one drawn across the smaller rounded square, which leaves a seam at every
 * corner; extrapolating from the colours at the artwork's own top and bottom
 * edges continues the same line, so the join is invisible.
 *
 * The logo is inset to 80% so the glyph lands at roughly 41% of the canvas —
 * comfortably inside the 56% square that fits in Android's 80% safe circle.
 * Filling the frame edge to edge instead would push the glyph's corners out to
 * 98% and get them clipped.
 */
const LOGO_INSET = 0.8

function fullBleed(size, output, { opaque = false } = {}) {
  const shape = shapeExtent()
  const middle = Math.round(shape.size / 2)

  const top = samplePixel(middle, shape.topPx + 3)
  const bottom = samplePixel(middle, shape.bottomPx - 3)

  // Where the artwork's own edges land once it is inset into the target canvas.
  const inset = (1 - LOGO_INSET) / 2
  const topAt = inset + shape.top * LOGO_INSET
  const bottomAt = inset + shape.bottom * LOGO_INSET
  const slope = top.map((c, i) => (bottom[i] - c) / (bottomAt - topAt))

  const canvasTop = top.map((c, i) => c - slope[i] * topAt)
  const canvasBottom = bottom.map((c, i) => c + slope[i] * (1 - bottomAt))

  const inner = Math.round(size * LOGO_INSET)
  const args = [
    '-size',
    `${size}x${size}`,
    `gradient:${hex(canvasTop)}-${hex(canvasBottom)}`,
    '(',
    SOURCE,
    '-resize',
    `${inner}x${inner}`,
    ')',
    '-gravity',
    'center',
    '-composite',
  ]
  // iOS composites any transparency onto black, so that variant is flattened.
  if (opaque) args.push('-background', hex(canvasTop), '-alpha', 'remove', '-alpha', 'off')
  args.push('-strip', output)
  run(args)
}

/** Multi-resolution favicon: browsers and OS shortcuts pick the size they need. */
function favicon(output) {
  run([SOURCE, '-strip', '-define', 'icon:auto-resize=48,32,16', output])
}

/** Renders text to its own image and reports the size, so nothing is guessed. */
function renderText(text, font, pointsize, fill, output) {
  run(['-background', 'none', '-font', font, '-pointsize', String(pointsize), '-fill', fill, `label:${text}`, output])
  const [width, height] = execFileSync('identify', ['-format', '%w %h', output], { encoding: 'utf8' })
    .split(' ')
    .map(Number)
  return { width, height }
}

/**
 * 1200x630 card for link previews, matching the app's dark surface.
 *
 * The wordmark and tagline are measured rather than positioned by eye: font
 * metrics differ between machines, and a hard-coded offset that fits here would
 * run off the edge somewhere else.
 */
function socialCard(output) {
  const font = findFont()
  const logo = join(PUBLIC, '.og-logo.png')
  const LOGO_SIZE = 260
  const GAP = 44
  const WIDTH = 1200
  const HEIGHT = 630
  const MARGIN = 80

  transparent(LOGO_SIZE, logo)

  if (!font) {
    // No usable font: a centred logo still reads as a deliberate card.
    run([
      '-size', `${WIDTH}x${HEIGHT}`, `xc:${CARD_BACKGROUND}`,
      '(', logo, '-resize', '320x320', ')', '-gravity', 'center', '-composite',
      '-strip', output,
    ])
    rmSync(logo, { force: true })
    return false
  }

  const available = WIDTH - MARGIN * 2 - LOGO_SIZE - GAP
  const wordmarkFile = join(PUBLIC, '.og-wordmark.png')
  const taglineFile = join(PUBLIC, '.og-tagline.png')

  const wordmark = renderText('Noter', font, 104, CARD_TEXT, wordmarkFile)

  // Shrink the tagline until it fits beside the logo rather than truncating it.
  let taglineSize = 36
  let tagline = renderText(TAGLINE, font, taglineSize, CARD_MUTED, taglineFile)
  while (tagline.width > available && taglineSize > 20) {
    taglineSize -= 2
    tagline = renderText(TAGLINE, font, taglineSize, CARD_MUTED, taglineFile)
  }

  const textWidth = Math.max(wordmark.width, tagline.width)
  const blockWidth = LOGO_SIZE + GAP + textWidth
  const left = Math.round((WIDTH - blockWidth) / 2)
  const textLeft = left + LOGO_SIZE + GAP

  // Vertically centre the logo, and the text block against it.
  const logoTop = Math.round((HEIGHT - LOGO_SIZE) / 2)
  const textHeight = wordmark.height + 12 + tagline.height
  const textTop = Math.round((HEIGHT - textHeight) / 2)

  run([
    '-size', `${WIDTH}x${HEIGHT}`, `xc:${CARD_BACKGROUND}`,
    '(', logo, ')', '-geometry', `+${left}+${logoTop}`, '-composite',
    '(', wordmarkFile, ')', '-geometry', `+${textLeft}+${textTop}`, '-composite',
    '(', taglineFile, ')', '-geometry', `+${textLeft}+${textTop + wordmark.height + 12}`, '-composite',
    '-strip', output,
  ])

  for (const file of [logo, wordmarkFile, taglineFile]) rmSync(file, { force: true })
  return true
}

// ---------------------------------------------------------------------------

requireImageMagick()

if (!existsSync(SOURCE)) {
  console.error(`\n  Source logo not found: ${SOURCE}\n`)
  process.exit(1)
}

mkdirSync(ICONS, { recursive: true })

const outputs = []

for (const size of [192, 512]) {
  const file = join(ICONS, `icon-${size}.png`)
  transparent(size, file)
  outputs.push(file)
}

for (const size of [192, 512]) {
  const file = join(ICONS, `maskable-${size}.png`)
  fullBleed(size, file)
  outputs.push(file)
}

// iOS composites transparency onto black and applies its own mask, so this one
// is opaque and full-bleed.
const apple = join(ICONS, 'apple-touch-icon.png')
fullBleed(180, apple, { opaque: true })
outputs.push(apple)

for (const size of [16, 32]) {
  const file = join(ICONS, `favicon-${size}.png`)
  transparent(size, file)
  outputs.push(file)
}

// The brand mark in the sidebar. Rendered at 18px, so 64 covers hi-dpi screens
// while staying a couple of kilobytes.
const brand = join(ICONS, 'logo-64.png')
transparent(64, brand)
outputs.push(brand)

const ico = join(PUBLIC, 'favicon.ico')
favicon(ico)
outputs.push(ico)

const og = join(PUBLIC, 'og.png')
const hasWordmark = socialCard(og)
outputs.push(og)

for (const file of outputs) {
  console.log(`  ${file.slice(ROOT.length + 1)}`)
}

if (!hasWordmark) {
  console.log('\n  No bold sans font found; the social card was generated without its wordmark.')
}
