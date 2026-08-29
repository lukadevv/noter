import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { checkboxOffset, parseTaskLine } from '$lib/md/tasks'

/**
 * Renders `[ ]` / `[x]` in the editor as a real checkbox.
 *
 * The markdown stays exactly as typed underneath; only the three bracket
 * characters are replaced visually, so selecting and editing the line still
 * behaves like plain text.
 */
class CheckboxWidget extends WidgetType {
  constructor(
    private readonly done: boolean,
    private readonly pos: number,
  ) {
    super()
  }

  override eq(other: CheckboxWidget): boolean {
    return other.done === this.done && other.pos === this.pos
  }

  override toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = this.done
    input.className = 'cm-task-checkbox'
    input.addEventListener('mousedown', (event) => {
      event.preventDefault()
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: this.done ? ' ' : 'x' },
      })
    })
    return input
  }

  override ignoreEvent(): boolean {
    return false
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const { doc } = view.state

  for (const { from, to } of view.visibleRanges) {
    let pos = from
    while (pos <= to) {
      const line = doc.lineAt(pos)
      const task = parseTaskLine(line.text, line.number - 1)
      if (task) {
        const offset = checkboxOffset(line.text)
        if (offset !== null) {
          const start = line.from + offset
          // Leave the checkbox as plain text while the cursor is inside it, so
          // the user can still edit the markdown by hand.
          const cursorInside = view.state.selection.ranges.some(
            (range) => range.from <= start + 3 && range.to >= start,
          )
          if (!cursorInside) {
            builder.add(start, start + 3, Decoration.replace({ widget: new CheckboxWidget(task.done, start) }))
          }
        }
      }
      if (line.to >= doc.length) break
      pos = line.to + 1
    }
  }

  return builder.finish()
}

export const taskCheckboxes = ViewPlugin.fromClass(
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
