import {
  createElement,
  FileText,
  Globe,
  Laptop,
  Monitor,
  Pill,
  ServerOff,
  ShieldCheck,
  Smartphone,
  Store,
  Target,
  Terminal,
  Timer,
  UserX,
  WifiOff,
  type IconNode,
} from 'lucide'
// @ts-expect-error -- a plain .mjs module with no type declarations
import { logoSvg } from '../../scripts/logo.mjs'

/**
 * Title cards. Every motion is a CSS animation with a delay, so the frame
 * recorder can step them like everything else; nothing here uses timers.
 */

interface CardCopy {
  intro: { headline: string; features: string[] }
  localFirst: { statements: string[]; kicker: string; platforms: string[] }
  outro: { tagline: string; url: string; store: string }
}

/** One icon and colour per area of the app, in the order of `intro.features`. */
const FEATURES: { icon: IconNode; tint: string }[] = [
  { icon: FileText, tint: '#8b8ce8' },
  { icon: Timer, tint: '#e06a5a' },
  { icon: Target, tint: '#5cbf92' },
  { icon: Pill, tint: '#d9a441' },
  { icon: ShieldCheck, tint: '#4fb3d9' },
]
const STATEMENT_ICONS = [UserX, ServerOff, WifiOff]
const PLATFORM_ICONS = [Globe, Monitor, Laptop, Terminal, Smartphone]

function el(tag: string, className = '', delayMs?: number): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (delayMs !== undefined) {
    node.style.animationDelay = `${delayMs}ms`
    node.style.setProperty('--d', `${delayMs}ms`)
  }
  return node
}

function icon(node: IconNode): Node {
  return createElement(node) as unknown as Node
}

/** The same mark as every icon of the app, with ripples as it lands. */
function logo(small = false): HTMLElement {
  const wrap = el('div', 'logo-wrap')
  wrap.append(el('div', 'halo'))
  for (let i = 0; i < 3; i++) wrap.append(el('div', 'ring', 380 + i * 250))
  const mark = el('div', small ? 'logo small' : 'logo')
  mark.innerHTML = logoSvg()
  // pathLength lets the CSS draw each bar with a dash of length 1.
  for (const line of mark.querySelectorAll('line')) line.setAttribute('pathLength', '1')
  wrap.append(mark)
  return wrap
}

/** Language of the card being drawn, for word breaking. */
let lang = 'en'

/**
 * Splits a sentence into the pieces that rise one after another. Languages
 * written with spaces split on them; Chinese and Japanese go through
 * Intl.Segmenter, with punctuation kept on the word before it.
 */
function words(text: string): string[] {
  if (/\s/.test(text.trim())) return text.trim().split(/\s+/)
  const pieces: string[] = []
  for (const { segment, isWordLike } of new Intl.Segmenter(lang, { granularity: 'word' }).segment(text)) {
    if (!isWordLike && pieces.length) pieces[pieces.length - 1] += segment
    else pieces.push(segment)
  }
  return pieces
}

/**
 * Text that rises out of a mask piece by piece: letters for short words,
 * words for sentences. The last word can take the accent gradient.
 */
function split(
  text: string,
  className: string,
  startMs: number,
  stepMs: number,
  by: 'char' | 'word',
  accentLast = false,
): HTMLElement {
  const wrap = el('div', `${className} split`)
  const pieces = by === 'char' ? [...text] : words(text)
  // Without spaces between them, the pieces sit flush.
  if (by === 'word' && !/\s/.test(text.trim())) wrap.style.columnGap = '0'
  pieces.forEach((piece, i) => {
    const mask = el('span')
    const inner = el('span', accentLast && i === pieces.length - 1 ? 'accent' : '', startMs + i * stepMs)
    inner.textContent = piece
    mask.append(inner)
    wrap.append(mask)
  })
  return wrap
}

/** Aurora blobs in two hues, a dot grid and a vignette. */
function backdrop(hueA: string, hueB: string): Node[] {
  const back = el('div', 'backdrop')
  back.style.setProperty('--hue-a', hueA)
  back.style.setProperty('--hue-b', hueB)
  back.append(el('div', 'blob a'), el('div', 'blob b'), el('div', 'blob c'))
  return [back, el('div', 'grid'), motes(), el('div', 'vignette')]
}

/**
 * Small motes rising slowly through the backdrop. Their placement is a fixed
 * sequence, so every render has the same ones; negative delays start them
 * already spread across the screen instead of all at the bottom.
 */
function motes(): HTMLElement {
  const layer = el('div', 'motes')
  let seed = 7
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const colors = ['#c9c8ff', '#8b8ce8', '#6ec3f0', '#ffc857']
  for (let i = 0; i < 30; i++) {
    const mote = el('div', 'mote')
    const size = 3 + random() * 6
    mote.style.left = `${random() * 100}%`
    mote.style.setProperty('--size', `${size.toFixed(1)}px`)
    mote.style.setProperty('--color', colors[Math.floor(random() * colors.length)]!)
    mote.style.setProperty('--alpha', (0.25 + random() * 0.45).toFixed(2))
    mote.style.setProperty('--dur', `${(9 + random() * 8).toFixed(1)}s`)
    mote.style.setProperty('--delay', `${(-random() * 14).toFixed(1)}s`)
    mote.style.setProperty('--sway', `${Math.round((random() - 0.5) * 220)}px`)
    layer.append(mote)
  }
  return layer
}

function intro(copy: CardCopy['intro'], content: HTMLElement): void {
  const chips = el('div', 'chips')
  copy.features.forEach((name, i) => {
    const feature = FEATURES[i % FEATURES.length]!
    const chip = el('div', 'chip', 1900 + i * 120)
    chip.style.setProperty('--tint', feature.tint)
    chip.append(icon(feature.icon), name)
    chips.append(chip)
  })
  content.append(
    logo(),
    split('Noter', 'wordmark', 650, 60, 'char'),
    split(copy.headline, 'headline', 1100, 90, 'word', true),
    chips,
  )
}

function localFirst(copy: CardCopy['localFirst'], content: HTMLElement): void {
  const statements = el('div', 'statements')
  copy.statements.forEach((text, i) => {
    const delay = 120 + i * 420
    const row = el('div', 'statement')
    row.style.setProperty('--d', `${delay}ms`)
    const badge = el('div', 'icon', delay)
    badge.append(icon(STATEMENT_ICONS[i % STATEMENT_ICONS.length]!))
    const line = el('div', 'text')
    const inner = el('span', '', delay + 80)
    inner.textContent = text
    line.append(inner)
    row.append(badge, line)
    statements.append(row)
  })
  const kicker = el('div', 'kicker', 1450)
  kicker.textContent = copy.kicker
  const platforms = el('div', 'platforms')
  copy.platforms.forEach((name, i) => {
    const chip = el('div', 'platform', 1750 + i * 90)
    chip.append(icon(PLATFORM_ICONS[i % PLATFORM_ICONS.length]!), name)
    platforms.append(chip)
  })
  content.append(statements, kicker, platforms)
}

function outro(copy: CardCopy['outro'], content: HTMLElement): void {
  const tagline = el('div', 'tagline rise', 500)
  tagline.textContent = copy.tagline
  // Typed out one character at a time.
  const url = el('div', 'url')
  const typeFrom = 800
  ;[...copy.url].forEach((char, i) => {
    const span = el('span', 'char', typeFrom + i * 45)
    span.textContent = char
    url.append(span)
  })
  url.append(el('span', 'caret'))
  const store = el('div', 'store', typeFrom + copy.url.length * 45 + 150)
  store.append(icon(Store), copy.store)
  content.append(logo(true), tagline, url, store)
}

const HUES: Record<keyof CardCopy, [string, string]> = {
  intro: ['#6d6af0', '#3d8fd6'],
  localFirst: ['#5550da', '#2fa58a'],
  outro: ['#7a5cf0', '#c2508f'],
}

/** Which card the stage's backdrop belongs to; the backdrop is built once per card. */
let primed: keyof CardCopy | null = null

function setLanguage(meta: { lang: string; dir: string }): void {
  lang = meta.lang
  document.documentElement.lang = meta.lang
  document.documentElement.dir = meta.dir
}

/**
 * Builds the backdrop of a card without any content, so it is already moving
 * (and the previous card is gone) before the card's text arrives. Drawing the
 * card afterwards only adds the content: rebuilding the backdrop at that point
 * would restart its fade-in and show up as a flash in the transition.
 */
function prime(name: keyof CardCopy, meta = { lang: 'en', dir: 'ltr' }): void {
  setLanguage(meta)
  document.getElementById('stage')!.replaceChildren(...backdrop(...HUES[name]), el('div', 'content'))
  primed = name
}

function draw(name: keyof CardCopy, copy: CardCopy, meta = { lang: 'en', dir: 'ltr' }): void {
  if (primed !== name) prime(name, meta)
  setLanguage(meta)
  const stage = document.getElementById('stage')!
  const content = el('div', 'content')
  stage.querySelector('.content')?.replaceWith(content)
  if (name === 'intro') intro(copy.intro, content)
  if (name === 'localFirst') localFirst(copy.localFirst, content)
  if (name === 'outro') outro(copy.outro, content)
}

declare global {
  interface Window {
    __card: typeof draw
    __cardPrime: typeof prime
  }
}

window.__card = draw
window.__cardPrime = prime
