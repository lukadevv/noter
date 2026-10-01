/**
 * The kinds of block a note is built from, and how each one is written.
 *
 * A note is plain markdown; a "block" is just a paragraph, a heading, a list
 * item, a quote, or a fenced block. Board and gallery are fences too
 * (```board, ```gallery), rendered inline by the editor. This module knows the
 * markdown for each kind - what to insert from the `/` menu and how to turn one
 * kind into another - and nothing about CodeMirror, so it can be unit-tested.
 */
import { wrapFence } from './fences'

export type BlockKind =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'numbered'
  | 'task'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  | 'table'
  | 'board'
  | 'gallery'
  | 'image'
  | 'date'

export interface BlockDef {
  kind: BlockKind
  icon: string
  /** i18n key under `blocks.` for the label. */
  label: string
  /** Extra words the `/` menu matches on, in English; labels are matched in every language. */
  aliases: string[]
  /** Kinds a line-based block can be turned into from the block menu. */
  convertible?: boolean
}

export const BLOCKS: BlockDef[] = [
  { kind: 'text', icon: 'type', label: 'blocks.text', aliases: ['paragraph', 'plain'], convertible: true },
  {
    kind: 'h1',
    icon: 'heading-1',
    label: 'blocks.h1',
    aliases: ['heading', 'title', '#'],
    convertible: true,
  },
  {
    kind: 'h2',
    icon: 'heading-2',
    label: 'blocks.h2',
    aliases: ['heading', 'subtitle', '##'],
    convertible: true,
  },
  { kind: 'h3', icon: 'heading-3', label: 'blocks.h3', aliases: ['heading', '###'], convertible: true },
  {
    kind: 'task',
    icon: 'check-square',
    label: 'blocks.task',
    aliases: ['todo', 'checkbox', 'checklist'],
    convertible: true,
  },
  { kind: 'bullet', icon: 'list', label: 'blocks.bullet', aliases: ['list', 'ul', '-'], convertible: true },
  {
    kind: 'numbered',
    icon: 'list-ordered',
    label: 'blocks.numbered',
    aliases: ['ordered', 'ol', '1.'],
    convertible: true,
  },
  { kind: 'quote', icon: 'quote', label: 'blocks.quote', aliases: ['blockquote', '>'], convertible: true },
  {
    kind: 'callout',
    icon: 'info',
    label: 'blocks.callout',
    aliases: ['note', 'tip', 'warning', 'admonition'],
    convertible: true,
  },
  {
    kind: 'code',
    icon: 'code',
    label: 'blocks.code',
    aliases: ['snippet', 'pre', '```'],
    convertible: true,
  },
  { kind: 'board', icon: 'square-kanban', label: 'blocks.board', aliases: ['kanban', 'columns', 'cards'] },
  { kind: 'gallery', icon: 'images', label: 'blocks.gallery', aliases: ['photos', 'pictures', 'grid'] },
  { kind: 'image', icon: 'image', label: 'blocks.image', aliases: ['picture', 'photo', 'img'] },
  { kind: 'table', icon: 'table', label: 'blocks.table', aliases: ['grid', 'spreadsheet'] },
  { kind: 'divider', icon: 'minus', label: 'blocks.divider', aliases: ['hr', 'separator', 'line', '---'] },
  { kind: 'date', icon: 'calendar', label: 'blocks.date', aliases: ['today', 'now', 'time'] },
]

const PREFIX = /^(\s*)(?:#{1,6}\s+|>\s*(?:\[![a-z]+\]\s*)?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)?/

/** A line without its block markup: `## Title` → `Title`, `- [ ] milk` → `milk`. */
export function stripPrefix(line: string): { indent: string; text: string } {
  const match = PREFIX.exec(line)!
  return { indent: match[1] ?? '', text: line.slice(match[0].length) }
}

/** The markup that starts a line of the given kind; `index` numbers ordered lists. */
export function prefixFor(kind: BlockKind, index = 0): string {
  switch (kind) {
    case 'h1':
      return '# '
    case 'h2':
      return '## '
    case 'h3':
      return '### '
    case 'bullet':
      return '- '
    case 'numbered':
      return `${index + 1}. `
    case 'task':
      return '- [ ] '
    case 'quote':
      return '> '
    default:
      return ''
  }
}

/**
 * Rewrites a run of lines as another kind of block. Line-based kinds swap the
 * prefix on every line; a callout or code block wraps the lines instead.
 */
export function turnLinesInto(lines: string[], kind: BlockKind): string[] {
  const plain = lines.map(stripPrefix)
  if (kind === 'code') return wrapFence('', plain.map((l) => l.indent + l.text).join('\n')).split('\n')
  if (kind === 'callout') return ['> [!note]', ...plain.map((l) => `> ${l.text}`)]
  // Headings are one line: joining keeps the text instead of making many headings.
  if (kind === 'h1' || kind === 'h2' || kind === 'h3') {
    return [
      prefixFor(kind) +
        plain
          .map((l) => l.text.trim())
          .filter(Boolean)
          .join(' '),
    ]
  }
  return plain.map((l, i) => l.indent + prefixFor(kind, i) + l.text)
}

/** The kind of a single line, for the block menu's "current" check mark. */
export function kindOfLine(line: string): BlockKind {
  const trimmed = line.trimStart()
  if (/^#\s/.test(trimmed)) return 'h1'
  if (/^##\s/.test(trimmed)) return 'h2'
  if (/^###\s/.test(trimmed)) return 'h3'
  if (/^[-*+]\s+\[[ xX]\]/.test(trimmed)) return 'task'
  if (/^[-*+]\s/.test(trimmed)) return 'bullet'
  if (/^\d+[.)]\s/.test(trimmed)) return 'numbered'
  if (/^>\s*\[![a-z]+\]/i.test(trimmed)) return 'callout'
  if (/^>/.test(trimmed)) return 'quote'
  if (/^(`{3,}|~{3,})/.test(trimmed)) return 'code'
  return 'text'
}

export const BOARD_TEMPLATE = (columns: [string, string, string]) =>
  wrapFence('board', columns.map((c) => `## ${c}\n`).join('\n'))

export interface Insertion {
  /** The markdown to insert. */
  text: string
  /** Where the cursor goes, as an offset into `text`. */
  cursor: number
  /** True when the block must stand alone, with blank lines around it. */
  standalone?: boolean
}

/**
 * The markdown the `/` menu inserts for a kind. Image and gallery pickers are
 * handled by the editor, which knows how to open a file chooser.
 */
export function insertionFor(
  kind: BlockKind,
  labels: { columns: [string, string, string]; now: Date },
): Insertion {
  switch (kind) {
    case 'divider':
      return { text: '---\n', cursor: 4, standalone: true }
    case 'code': {
      const text = '```\n\n```'
      return { text, cursor: 3, standalone: true }
    }
    case 'table': {
      const text = '| Column | Column |\n| --- | --- |\n|  |  |'
      return { text, cursor: 2, standalone: true }
    }
    case 'board': {
      const text = BOARD_TEMPLATE(labels.columns)
      return { text, cursor: text.length, standalone: true }
    }
    case 'gallery': {
      const text = wrapFence('gallery', '')
      return { text, cursor: text.length, standalone: true }
    }
    case 'callout': {
      const text = '> [!note] '
      return { text, cursor: text.length }
    }
    case 'date': {
      const text = labels.now.toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      return { text, cursor: text.length }
    }
    default: {
      const text = prefixFor(kind)
      return { text, cursor: text.length }
    }
  }
}
