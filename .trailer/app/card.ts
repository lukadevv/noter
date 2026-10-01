import {
  createElement,
  Globe,
  Laptop,
  Monitor,
  ServerOff,
  Smartphone,
  Store,
  Terminal,
  UserX,
  WifiOff,
} from 'lucide'
// @ts-expect-error -- a plain .mjs module with no type declarations
import { logoSvg } from '../../scripts/logo.mjs'

/** The same mark as every icon of the app, drawn from scripts/logo.mjs. */
function logo(small = false): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = small ? 'logo small' : 'logo'
  wrap.innerHTML = logoSvg()
  // pathLength lets the CSS draw each bar with a dash of length 1.
  for (const line of wrap.querySelectorAll('line')) line.setAttribute('pathLength', '1')
  return wrap
}

function el(tag: string, className: string, text = '', delayMs = 0): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text) node.textContent = text
  if (delayMs) node.style.animationDelay = `${delayMs}ms`
  return node
}

function withIcon(node: HTMLElement, icon: Parameters<typeof createElement>[0]): HTMLElement {
  node.prepend(createElement(icon) as unknown as Node)
  return node
}

interface CardCopy {
  intro: { line: string; sub: string }
  localFirst: { line: string; platforms: string[] }
  outro: { url: string; store: string }
}

const PLATFORM_ICONS = [Globe, Monitor, Laptop, Terminal, Smartphone]
const FACT_ICONS = [UserX, ServerOff, WifiOff]

function draw(name: keyof CardCopy, copy: CardCopy): void {
  const stage = document.getElementById('stage')!
  stage.replaceChildren(el('div', 'glow'))
  const content = el('div', 'content')
  stage.append(content)

  if (name === 'intro') {
    content.append(
      logo(),
      el('div', 'wordmark rise', 'Noter', 700),
      el('div', 'line rise', copy.intro.line, 1250),
      el('div', 'sub rise', copy.intro.sub, 1900),
    )
  }

  if (name === 'localFirst') {
    // "No account. No server. Works offline." becomes three chips, one per sentence.
    const sentences = copy.localFirst.line.match(/[^.!?。！？]+[.!?。！？]?/g)?.map((s) => s.trim()) ?? []
    const facts = el('div', 'facts')
    sentences.forEach((sentence, i) =>
      facts.append(
        withIcon(el('div', 'fact rise', sentence, 150 + i * 380), FACT_ICONS[i % FACT_ICONS.length]!),
      ),
    )
    const platforms = el('div', 'platforms')
    copy.localFirst.platforms.forEach((platform, i) =>
      platforms.append(
        withIcon(
          el('div', 'platform rise', platform, 1500 + i * 110),
          PLATFORM_ICONS[i % PLATFORM_ICONS.length]!,
        ),
      ),
    )
    content.append(facts, platforms)
  }

  if (name === 'outro') {
    content.append(
      logo(true),
      el('div', 'url rise', copy.outro.url, 650),
      withIcon(el('div', 'store rise', copy.outro.store, 1050), Store),
    )
  }
}

declare global {
  interface Window {
    __card: typeof draw
  }
}

window.__card = draw
