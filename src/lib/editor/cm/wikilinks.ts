import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { autocompletion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'

const LINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

/** Tints `[[links]]` in the source without hiding their syntax. */
function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to)
    LINK.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = LINK.exec(text)) !== null) {
      if (match[1]!.startsWith('img:')) continue
      builder.add(
        from + match.index,
        from + match.index + match[0].length,
        Decoration.mark({ class: 'cm-wikilink', attributes: { 'data-link': match[1]!.trim() } }),
      )
    }
  }

  return builder.finish()
}

export const wikiLinkHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

/**
 * Follows a `[[link]]` on Ctrl/⌘-click — a plain click places the cursor, as in
 * any editor — or on a plain click when the note is locked for editing, where
 * placing a cursor to type has no point.
 */
export function wikiLinkClicks(onLink: (target: string) => void) {
  return EditorView.domEventHandlers({
    mousedown: (event, view) => {
      const link = (event.target as HTMLElement | null)?.closest<HTMLElement>('.cm-wikilink')
      const target = link?.dataset.link
      if (!target || event.button !== 0) return false
      if (!(event.ctrlKey || event.metaKey || view.state.readOnly)) return false
      event.preventDefault()
      onLink(target)
      return true
    },
  })
}

export interface CompletionSources {
  /** Existing note titles, for `[[` completion. */
  titles: () => string[]
  /** Existing tags, for `#` completion. */
  tags: () => string[]
}

/**
 * Completion for `[[note title]]` and `#tag`.
 *
 * Both read from live getters rather than a snapshot, so a note created a moment
 * ago is immediately offered without rebuilding the editor.
 */
export function noterCompletion(sources: CompletionSources) {
  function complete(context: CompletionContext): CompletionResult | null {
    const link = context.matchBefore(/\[\[[^\]\n]*/)
    if (link) {
      const typed = link.text.slice(2)
      return {
        from: link.from + 2,
        options: sources.titles().map((title) => ({ label: title, type: 'text' })),
        filter: typed.length > 0,
      }
    }

    const tag = context.matchBefore(/#[\p{L}\p{N}_/-]*/u)
    if (tag && (tag.from === 0 || /[\s([{]/.test(context.state.doc.sliceString(tag.from - 1, tag.from)))) {
      // Tags are read out of the text, so a half-typed one is already in the tag
      // list. Offering it back as a completion of itself is pure noise.
      const typed = tag.text.slice(1)
      return {
        from: tag.from + 1,
        options: sources
          .tags()
          .filter((name) => name !== typed)
          .map((name) => ({ label: name, type: 'keyword' })),
        filter: tag.text.length > 1,
      }
    }

    return null
  }

  return autocompletion({ override: [complete], icons: false, activateOnTyping: true })
}
