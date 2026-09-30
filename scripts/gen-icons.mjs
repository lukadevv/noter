/**
 * Generates every icon and social image from the logo in `scripts/logo.mjs`.
 *
 * Everything under `public/`, `android/` and the MSIX assets is derived and
 * committed, so a clone needs no image tooling to build. Rendering uses resvg
 * (a devDependency), so there is no system dependency either.
 *
 * Two families come out of this:
 *
 *  - **Transparent, rounded** — the logo as drawn. Favicons and the PWA's
 *    `purpose: any` icons, which sit on backgrounds we do not control.
 *  - **Full-bleed square** — the gradient to the edges with the glyph inset.
 *    Android crops maskable icons to its own shape and iOS applies its own
 *    rounding, so an icon with rounded corners of its own gets clipped twice.
 *
 * Tauri's desktop icons are produced afterwards with
 * `pnpm exec tauri icon assets/logo-1024.png -o src-tauri/icons`.
 */
import { Resvg } from '@resvg/resvg-js'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  BRAND_BOTTOM,
  BRAND_TOP,
  foregroundSvg,
  fullBleedSvg,
  glyph,
  logoSvg,
  squirclePath,
  wideSvg,
} from './logo.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const ICONS = join(PUBLIC, 'icons')
const MSIX = join(ROOT, 'src-tauri/windows/msix/Assets')

const CARD_BACKGROUND = '#17171c'
const CARD_TEXT = '#edecf2'
const CARD_MUTED = '#a8a6b4'
const TAGLINE = 'Local-first notes, timers, meds and a vault'

function png(svg, width, height = width) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
  })
  const image = resvg.render()
  if (image.height !== height)
    throw new Error(`Expected ${width}x${height}, got ${image.width}x${image.height}`)
  return image.asPng()
}

const outputs = []
function write(file, data) {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, data)
  outputs.push(file)
}

/** An .ico holding PNG images, which every Windows since Vista reads. */
function ico(sizes) {
  const images = sizes.map((size) => png(logoSvg(), size))
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach((image, i) => {
    const entry = 6 + i * 16
    const size = sizes[i]
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })
  return Buffer.concat([header, ...images])
}

function socialCard() {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">` +
    `<rect width="1200" height="630" fill="${CARD_BACKGROUND}"/>` +
    `<g transform="translate(120 175) scale(0.273)">${logoSvg().replace(/^<svg[^>]*>|<\/svg>$/g, '')}</g>` +
    `<text x="440" y="300" font-family="DejaVu Sans" font-weight="bold" font-size="112" fill="${CARD_TEXT}">Noter</text>` +
    `<text x="444" y="380" font-family="DejaVu Sans" font-size="30" fill="${CARD_MUTED}">${TAGLINE}</text>` +
    `</svg>`
  return png(svg, 1200, 630)
}

// The editable source, for anyone who wants the vector.
write(join(ROOT, 'assets/logo.svg'), logoSvg() + '\n')
write(join(ROOT, 'assets/logo-1024.png'), png(logoSvg(), 1024))

for (const size of [192, 512]) {
  write(join(ICONS, `icon-${size}.png`), png(logoSvg(), size))
  write(join(ICONS, `maskable-${size}.png`), png(fullBleedSvg(0.8), size))
}
// iOS composites transparency onto black and applies its own mask.
write(join(ICONS, 'apple-touch-icon.png'), png(fullBleedSvg(0.78), 180))
for (const size of [16, 32]) write(join(ICONS, `favicon-${size}.png`), png(logoSvg(), size))
write(join(ICONS, 'logo-64.png'), png(logoSvg(), 64))
write(join(PUBLIC, 'favicon.ico'), ico([16, 32, 48]))
write(join(PUBLIC, 'og.png'), socialCard())

/**
 * Android launcher icons. Android 8+ composes the glyph on transparency over
 * the gradient in `ic_launcher_gradient.xml`; `ic_launcher.png` is the flat
 * fallback for older launchers.
 */
const ANDROID_RES = join(ROOT, 'android/app/src/main/res')
const ANDROID_DENSITIES = [
  ['mdpi', 48, 108],
  ['hdpi', 72, 162],
  ['xhdpi', 96, 216],
  ['xxhdpi', 144, 324],
  ['xxxhdpi', 192, 432],
]
if (existsSync(ANDROID_RES)) {
  for (const [density, legacy, adaptive] of ANDROID_DENSITIES) {
    const dir = join(ANDROID_RES, `mipmap-${density}`)
    write(join(dir, 'ic_launcher.png'), png(fullBleedSvg(0.8), legacy))
    write(join(dir, 'ic_launcher_round.png'), png(fullBleedSvg(0.72), legacy))
    write(join(dir, 'ic_launcher_foreground.png'), png(foregroundSvg(0.6), adaptive))
  }
  write(
    join(ANDROID_RES, 'drawable/ic_launcher_gradient.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generated by scripts/gen-icons.mjs: the brand gradient behind the adaptive icon. -->
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient android:angle="270" android:startColor="${BRAND_TOP}" android:endColor="${BRAND_BOTTOM}" />
</shape>
`,
  )
}

/** Microsoft Store (MSIX) visual assets referenced by the AppxManifest. */
write(join(MSIX, 'Square44x44Logo.png'), png(logoSvg(), 44))
write(join(MSIX, 'Square44x44Logo.targetsize-256_altform-unplated.png'), png(logoSvg(), 256))
write(join(MSIX, 'Square150x150Logo.png'), png(wideSvg(150, 150, 104), 150))
write(join(MSIX, 'Wide310x150Logo.png'), png(wideSvg(310, 150, 104), 310, 150))
write(join(MSIX, 'StoreLogo.png'), png(logoSvg(), 50))
write(join(MSIX, 'SplashScreen.png'), png(wideSvg(620, 300, 200), 620, 300))

for (const file of outputs) console.log(`  ${file.slice(ROOT.length + 1)}`)

/**
 * The inline sidebar mark. Kept as a component (not an <img>) so it themes and
 * never flashes; generated here so it cannot drift from the icons.
 */
const logoComponent = `<script lang="ts">
  /**
   * The Noter mark, inline so it themes and never flashes while an image loads.
   * Generated from scripts/logo.mjs by scripts/gen-icons.mjs; edit the logo
   * there, not here.
   */
  interface Props {
    size?: number
    /** 'color' is the full logo; 'mono' draws the glyph in currentColor. */
    variant?: 'color' | 'mono'
  }

  let { size = 20, variant = 'color' }: Props = $props()
  const id = \`logo-\${Math.random().toString(36).slice(2, 8)}\`
</script>

<svg class="logo logo--{variant}" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
  {#if variant === 'color'}
    <defs>
      <linearGradient {id} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="${BRAND_TOP}" />
        <stop offset="1" stop-color="${BRAND_BOTTOM}" />
      </linearGradient>
    </defs>
    <path d="${squirclePath(1024, 24)}" fill="url(#{id})" />
  {/if}
  ${glyph({ bar: 'var(--logo-bar, #fff)', dot: 'var(--logo-dot, #ffc857)' })}
</svg>

<style>
  .logo {
    flex: none;
  }

  .logo--mono {
    --logo-bar: currentColor;
    --logo-dot: var(--accent);
  }
</style>
`
write(join(ROOT, 'src/components/Logo.svelte'), logoComponent)
