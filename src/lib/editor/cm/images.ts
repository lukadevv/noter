import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { assetUrl } from '$lib/images/urls'

const IMAGE_REF = /!\[\[img:([0-9a-f-]{36})\]\]/g

/** Shows a stored image inline in the editor, in place of its `![[img:id]]` reference. */
class ImageWidget extends WidgetType {
  constructor(private readonly assetId: string) {
    super()
  }

  override eq(other: ImageWidget): boolean {
    return other.assetId === this.assetId
  }

  override toDOM(): HTMLElement {
    const figure = document.createElement('span')
    figure.className = 'cm-inline-image'

    const image = document.createElement('img')
    image.alt = ''
    image.loading = 'lazy'
    image.draggable = false
    // Picked up by the app-wide lightbox handler.
    image.dataset.asset = this.assetId
    figure.append(image)

    void assetUrl(this.assetId, 'thumb').then((url) => {
      if (url) image.src = url
      else figure.classList.add('cm-inline-image--missing')
    })

    return figure
  }

  override ignoreEvent(): boolean {
    return false
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { doc } = view.state

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to)
    IMAGE_REF.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = IMAGE_REF.exec(text)) !== null) {
      const start = from + match.index
      const end = start + match[0].length
      // Reveal the raw reference when the cursor is on it, so it can be deleted.
      const cursorInside = view.state.selection.ranges.some(
        (range) => range.from <= end && range.to >= start,
      )
      if (!cursorInside) {
        builder.add(start, end, Decoration.replace({ widget: new ImageWidget(match[1]!) }))
      }
    }
  }

  return builder.finish()
}

export const inlineImages = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
)

export interface PasteHandlers {
  /** Receives images pasted or dropped into the editor; returns markdown to insert. */
  onImages: (files: File[]) => Promise<string[]>
  /** Receives a pasted URL; returns markdown, or null to paste it as plain text. */
  onUrl: (url: string) => Promise<string | null>
}

function insertAtCursor(view: EditorView, text: string): void {
  const { from, to } = view.state.selection.main
  view.dispatch({
    changes: { from, to, insert: text },
    selection: { anchor: from + text.length },
    scrollIntoView: true,
  })
}

const BARE_URL = /^https?:\/\/\S+$/i

/**
 * Intercepts image pastes and drops.
 *
 * Insertion happens asynchronously (encoding and hashing take a moment), so the
 * position is captured up front and a placeholder holds the spot, otherwise a
 * fast typist would have their image land in the middle of the next sentence.
 */
export function imageInput(handlers: PasteHandlers) {
  const insertLater = (view: EditorView, work: Promise<string[]>) => {
    const placeholder = '![uploading…]()'
    const { from, to } = view.state.selection.main
    view.dispatch({
      changes: { from, to, insert: placeholder },
      selection: { anchor: from + placeholder.length },
    })

    void work.then((snippets) => {
      const text = snippets.join('\n')
      const doc = view.state.doc.toString()
      const at = doc.indexOf(placeholder)
      if (at === -1) {
        // The placeholder was edited away; fall back to the cursor.
        if (text) insertAtCursor(view, text)
        return
      }
      view.dispatch({
        changes: { from: at, to: at + placeholder.length, insert: text },
        selection: { anchor: at + text.length },
      })
    })
  }

  return EditorView.domEventHandlers({
    paste(event, view) {
      const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (files.length > 0) {
        event.preventDefault()
        insertLater(view, handlers.onImages(files))
        return true
      }

      const text = event.clipboardData?.getData('text/plain')?.trim() ?? ''
      if (BARE_URL.test(text)) {
        event.preventDefault()
        insertLater(
          view,
          handlers.onUrl(text).then((markdown) => [markdown ?? text]),
        )
        return true
      }
      return false
    },

    drop(event, view) {
      const files = [...(event.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      if (files.length === 0) return false
      event.preventDefault()

      // Drop at the pointer, not wherever the caret happened to be.
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos !== null) view.dispatch({ selection: { anchor: pos } })
      insertLater(view, handlers.onImages(files))
      return true
    },

    dragover(event) {
      if ([...(event.dataTransfer?.types ?? [])].includes('Files')) {
        event.preventDefault()
        return true
      }
      return false
    },
  })
}
