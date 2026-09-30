import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'
import { parseBoard } from './board'

/**
 * Markdown rendering for the reading view.
 *
 * `html: false` is the first line of defence: raw HTML in a note body is never
 * parsed, so a pasted `<img onerror=...>` is inert text. DOMPurify is the second,
 * covering anything the renderer itself could emit (notably `javascript:` URLs).
 */
const md: MarkdownIt = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: false,
})

/** Task list items render as real (read-only) checkboxes the view layer wires up. */
md.renderer.rules.list_item_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]!
  const line = token.map?.[0]
  if (line !== undefined) token.attrSet('data-line', String(line))
  return self.renderToken(tokens, idx, options)
}

// The trailing space is optional so a freshly inserted, still-empty `- [ ]`
// renders as a checkbox rather than a literal bracket pair.
const TASK_RE = /^\[([ xX])\](\s+|$)/

const IMAGE_REF = /^!\[\[img:([0-9a-f-]{36})\]\]/

/**
 * `![[img:<id>]]` refers to an image held in IndexedDB. It renders as an <img>
 * with no `src`: the blob URL is resolved asynchronously by the view, because a
 * synchronous renderer cannot await a database read.
 */
md.inline.ruler.before('image', 'noter_image_ref', (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x21 /* ! */) return false
  const match = IMAGE_REF.exec(state.src.slice(state.pos))
  if (!match) return false

  if (!silent) {
    const token = state.push('noter_image', 'img', 0)
    token.attrSet('data-asset', match[1]!)
    token.attrSet('alt', '')
  }
  state.pos += match[0].length
  return true
})

md.renderer.rules.noter_image = (tokens, idx, _options, _env, self) =>
  `<img class="asset" loading="lazy" ${self.renderAttrs(tokens[idx]!)}>`

const WIKI_LINK = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/

/**
 * `[[Note title]]` links to another note by title, optionally with `|alias`.
 * Resolution happens in the view, which knows the current note set; the renderer
 * only emits the reference.
 */
md.inline.ruler.before('link', 'noter_wiki_link', (state, silent) => {
  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false
  const match = WIKI_LINK.exec(state.src.slice(state.pos))
  if (!match) return false

  const target = match[1]!.trim()
  if (target.startsWith('img:')) return false

  if (!silent) {
    const token = state.push('noter_wiki_link', 'a', 0)
    token.attrSet('data-link', target)
    token.content = match[2]?.trim() || target
  }
  state.pos += match[0].length
  return true
})

md.renderer.rules.noter_wiki_link = (tokens, idx, _options, _env, self) => {
  const token = tokens[idx]!
  return `<a class="wikilink" ${self.renderAttrs(token)}>${md.utils.escapeHtml(token.content)}</a>`
}

/** Rewrites `[ ] text` at the start of a list item into a checkbox element. */
md.core.ruler.after('inline', 'noter_tasklist', (state) => {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.type !== 'inline') continue
    const parent = tokens[i - 1]
    if (!parent || parent.type !== 'paragraph_open') continue
    const grandparent = tokens[i - 2]
    if (!grandparent || grandparent.type !== 'list_item_open') continue

    const match = TASK_RE.exec(token.content)
    if (!match) continue

    const checked = match[1]!.toLowerCase() === 'x'
    token.content = token.content.slice(match[0].length)
    const first = token.children?.[0]
    if (first && first.type === 'text') first.content = first.content.replace(TASK_RE, '')

    const checkbox = new state.Token('html_inline', '', 0)
    checkbox.content = `<input class="task-checkbox" type="checkbox" ${checked ? 'checked' : ''} data-line="${grandparent.map?.[0] ?? ''}">`
    token.children?.unshift(checkbox)

    grandparent.attrJoin('class', checked ? 'task-item task-item--done' : 'task-item')
  }
  return true
})

/**
 * Board and gallery blocks render as what they are, not as code. Card text is
 * rendered inline (links, emphasis) and everything is sanitised below.
 */
const defaultFence = md.renderer.rules.fence!
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]!
  const kind = token.info.trim().split(/\s+/)[0]?.toLowerCase()
  if (kind === 'board') {
    const columns = parseBoard(token.content)
    const html = columns
      .map(
        (column) =>
          `<section class="md-board-column"><h4>${md.utils.escapeHtml(column.title)}</h4>` +
          column.cards
            .map(
              (card) =>
                `<div class="md-board-card${card.done ? ' md-board-card--done' : ''}">${md.renderInline(card.text)}</div>`,
            )
            .join('') +
          '</section>',
      )
      .join('')
    return `<div class="md-board">${html}</div>\n`
  }
  if (kind === 'gallery') {
    const ids = [...token.content.matchAll(/!\[\[img:([0-9a-f-]{36})\]\]/g)].map((m) => m[1]!)
    const html = ids.map((id) => `<img class="asset" loading="lazy" data-asset="${id}" alt="">`).join('')
    return `<div class="md-gallery">${html}</div>\n`
  }
  return defaultFence(tokens, idx, options, env, self)
}

/** `> [!tip] Title` becomes a callout box: the marker turns into a class. */
md.core.ruler.after('inline', 'noter_callout', (state) => {
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i]!.type !== 'blockquote_open') continue
    const inline = tokens[i + 2]
    if (!inline || inline.type !== 'inline') continue
    const match = /^\[!([a-z]+)\]\s*/i.exec(inline.content)
    if (!match) continue
    const kind = match[1]!.toLowerCase()
    tokens[i]!.attrJoin('class', `callout callout--${kind}`)
    inline.content = inline.content.slice(match[0].length)
    const first = inline.children?.[0]
    if (first && first.type === 'text') first.content = first.content.replace(/^\[![a-z]+\]\s*/i, '')
    const label = new state.Token('html_inline', '', 0)
    label.content = `<strong class="callout-label">${kind[0]!.toUpperCase()}${kind.slice(1)}</strong> `
    inline.children?.unshift(label)
  }
  return true
})

const PURIFY_CONFIG = {
  ADD_ATTR: [
    'data-line',
    'data-asset',
    'data-link',
    'data-external',
    'referrerpolicy',
    'target',
    'rel',
    'checked',
    'loading',
  ],
  ADD_TAGS: ['input'],
  FORBID_TAGS: ['style', 'form', 'iframe', 'object', 'embed'],
  FORBID_ATTR: ['style', 'srcset', 'formaction'],
}

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  // External links open in a new tab and must not hand the opener over.
  if (node instanceof HTMLAnchorElement && /^https?:/i.test(node.getAttribute('href') ?? '')) {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer nofollow')
  }

  // Remote images are flagged so the view can mark them as external: they leak
  // the reader's IP to the host and break when the URL rots.
  if (node instanceof HTMLImageElement && /^https?:/i.test(node.getAttribute('src') ?? '')) {
    node.setAttribute('data-external', 'true')
    node.setAttribute('referrerpolicy', 'no-referrer')
    node.setAttribute('loading', 'lazy')
  }
})

export function renderMarkdown(source: string): string {
  return DOMPurify.sanitize(md.render(source), PURIFY_CONFIG)
}

export function renderInline(source: string): string {
  return DOMPurify.sanitize(md.renderInline(source), PURIFY_CONFIG)
}
