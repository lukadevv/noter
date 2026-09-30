import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, type EditorState, type Range } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate,
} from '@codemirror/view'
import { CONTENT_FENCES } from '$lib/md/fences'

/**
 * Live preview: markdown reads as formatted text, and its markup appears only
 * where you are editing.
 *
 * Heading hashes, emphasis stars, inline-code backticks, link targets and quote
 * markers are hidden unless the cursor is on that line (block markup) or inside
 * that span (inline markup), so the note looks finished while every character
 * stays one keystroke away. `[[wiki links]]` keep their brackets on purpose —
 * they are part of how links are typed and searched for.
 */

class BulletWidget extends WidgetType {
  override eq(): boolean {
    return true
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '•'
    return span
  }
}

class RuleWidget extends WidgetType {
  override eq(): boolean {
    return true
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-rule'
    return span
  }
}

const CALLOUT_ICONS: Record<string, string> = {
  note: 'ℹ',
  info: 'ℹ',
  tip: '✦',
  success: '✓',
  warning: '!',
  caution: '!',
  danger: '✕',
  important: '★',
  question: '?',
}

class CalloutWidget extends WidgetType {
  constructor(readonly kind: string) {
    super()
  }
  override eq(other: CalloutWidget): boolean {
    return other.kind === this.kind
  }
  override toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = `cm-callout-label cm-callout-label--${this.kind}`
    span.textContent = `${CALLOUT_ICONS[this.kind] ?? 'ℹ'} ${this.kind[0]!.toUpperCase()}${this.kind.slice(1)}`
    return span
  }
}

const hide = Decoration.replace({})
const bullet = Decoration.replace({ widget: new BulletWidget() })
const rule = Decoration.replace({ widget: new RuleWidget() })
const mdLink = Decoration.mark({ class: 'cm-md-link' })

function lineClass(cls: string) {
  return Decoration.line({ class: cls })
}

/** True when any selection range touches [from, to]. */
function touches(state: EditorState, from: number, to: number): boolean {
  return state.selection.ranges.some((r) => r.from <= to && r.to >= from)
}

function lineTouched(state: EditorState, pos: number): boolean {
  const line = state.doc.lineAt(pos)
  return touches(state, line.from, line.to)
}

const CALLOUT = /^(\s*>\s*)\[!([a-z]+)\]/i

function build(view: EditorView): DecorationSet {
  const { state } = view
  const marks: Range<Decoration>[] = []
  const tree = syntaxTree(state)
  // Only when the editor has focus does the cursor mean "I am editing here";
  // an unfocused note renders fully.
  const focused = view.hasFocus

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name
        if (name === 'FencedCode') {
          const info = state.doc.sliceString(node.from, Math.min(node.to, node.from + 40))
          const kind = /^\s*(?:`{3,}|~{3,})\s*([\w-]+)/.exec(info)?.[1]?.toLowerCase() ?? ''
          // Boards and galleries are drawn by the block widgets instead.
          if (CONTENT_FENCES.has(kind)) return false
          const first = state.doc.lineAt(node.from).number
          const last = state.doc.lineAt(node.to).number
          for (let n = first; n <= last; n++) {
            const line = state.doc.line(n)
            const edge = n === first ? ' cm-codeblock--first' : n === last ? ' cm-codeblock--last' : ''
            marks.push(lineClass(`cm-codeblock${edge}`).range(line.from))
          }
          return false
        }

        const headingLevel = /^ATXHeading(\d)$/.exec(name)?.[1]
        if (headingLevel) {
          marks.push(
            lineClass(`cm-heading cm-heading-${headingLevel}`).range(state.doc.lineAt(node.from).from),
          )
          return
        }

        if (name === 'HeaderMark') {
          if (focused && lineTouched(state, node.from)) return
          // Hide "## " including the space after the hashes.
          const after = state.doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
          if (node.from < after) marks.push(hide.range(node.from, after))
          return
        }

        if (name === 'EmphasisMark' || name === 'StrikethroughMark') {
          const parent = node.node.parent
          if (parent && focused && touches(state, parent.from, parent.to)) return
          marks.push(hide.range(node.from, node.to))
          return
        }

        if (name === 'CodeMark') {
          const parent = node.node.parent
          if (!parent || parent.name !== 'InlineCode') return
          if (focused && touches(state, parent.from, parent.to)) return
          marks.push(hide.range(node.from, node.to))
          return
        }

        if (name === 'Link') {
          const text = state.doc.sliceString(node.from, node.to)
          // `[[wiki]]` links are their own thing; images too.
          if (text.startsWith('[[') || text.startsWith('!')) return false
          if (focused && touches(state, node.from, node.to)) return false
          if (text.includes('\n')) return false
          const close = text.indexOf('](')
          if (close < 0) return false
          marks.push(hide.range(node.from, node.from + 1))
          marks.push(mdLink.range(node.from + 1, node.from + close))
          marks.push(hide.range(node.from + close, node.to))
          return false
        }

        if (name === 'ListMark') {
          const text = state.doc.sliceString(node.from, node.to)
          if (!/^[-*+]$/.test(text)) return
          // Task items show a checkbox instead; leave their marker alone.
          const next = state.doc.sliceString(node.to, node.to + 4)
          if (/^\s\[[ xX]\]/.test(next)) return
          if (focused && lineTouched(state, node.from)) return
          marks.push(bullet.range(node.from, node.to))
          return
        }

        if (name === 'HorizontalRule') {
          if (focused && lineTouched(state, node.from)) return
          marks.push(rule.range(node.from, node.to))
          return
        }

        if (name === 'Blockquote') {
          const first = state.doc.lineAt(node.from)
          const callout = CALLOUT.exec(first.text)
          const cls = callout ? `cm-callout cm-callout--${callout[2]!.toLowerCase()}` : 'cm-quote'
          const last = state.doc.lineAt(node.to).number
          for (let n = first.number; n <= last; n++) {
            const line = state.doc.line(n)
            const edge = n === first.number ? ' cm-block--first' : n === last ? ' cm-block--last' : ''
            marks.push(lineClass(cls + edge).range(line.from))
          }
          if (callout && !(focused && lineTouched(state, first.from))) {
            const start = first.from + callout[1]!.length
            marks.push(
              Decoration.replace({ widget: new CalloutWidget(callout[2]!.toLowerCase()) }).range(
                start,
                start + callout[0].length - callout[1]!.length,
              ),
            )
          }
          return
        }

        if (name === 'QuoteMark') {
          if (focused && lineTouched(state, node.from)) return
          const after = state.doc.sliceString(node.to, node.to + 1) === ' ' ? node.to + 1 : node.to
          marks.push(hide.range(node.from, after))
          return
        }
      },
    })
  }

  // Line decorations must come before marks at the same position; sort once.
  marks.sort((a, b) => a.from - b.from || a.value.startSide - b.value.startSide)
  const builder = new RangeSetBuilder<Decoration>()
  let lastTo = -1
  for (const mark of marks) {
    // Replacements must not overlap; the first one at a spot wins.
    if (mark.value.point && mark.from < lastTo) continue
    builder.add(mark.from, mark.to, mark.value)
    if (mark.value.point) lastTo = mark.to
  }
  return builder.finish()
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = build(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        update.focusChanged ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = build(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)
