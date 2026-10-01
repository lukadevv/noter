import { EditorView } from '@codemirror/view'
import { menu } from '$lib/stores/menu.svelte'
import { t } from '$lib/i18n/index.svelte'
import type { MenuItem } from '$lib/ui-types'
import { INSERTABLE, insertAtCursor, type InsertOptions } from './insert'

function selectedText(view: EditorView): string {
  return view.state.selection.ranges.map((r) => view.state.sliceDoc(r.from, r.to)).join('\n')
}

/** Clipboard actions plus every block kind, for a right-click inside the note. */
export function editorMenuItems(view: EditorView, options: InsertOptions): MenuItem[] {
  const text = selectedText(view)
  const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined
  return [
    {
      id: 'cut',
      label: t('blocks.cut'),
      icon: 'scissors',
      shortcut: 'Mod+X',
      disabled: !text || !clipboard,
      run: () => {
        void clipboard?.writeText(text).then(() => {
          view.dispatch(view.state.replaceSelection(''), { userEvent: 'delete.cut' })
          view.focus()
        })
      },
    },
    {
      id: 'copy',
      label: t('blocks.copy'),
      icon: 'copy',
      shortcut: 'Mod+C',
      disabled: !text || !clipboard,
      run: () => void clipboard?.writeText(text),
    },
    {
      id: 'paste',
      label: t('blocks.paste'),
      icon: 'clipboard-paste',
      shortcut: 'Mod+V',
      disabled: !clipboard?.readText,
      run: () => {
        // Reading the clipboard can be refused (a permission prompt said no);
        // the shortcut still works, so there is nothing more to explain.
        void clipboard
          ?.readText()
          .then((pasted) => {
            if (!pasted) return
            view.dispatch(view.state.replaceSelection(pasted), {
              userEvent: 'input.paste',
              scrollIntoView: true,
            })
            view.focus()
          })
          .catch(() => {})
      },
    },
    {
      id: 'insert',
      label: t('blocks.insert'),
      icon: 'plus',
      separatorBefore: true,
      submenu: INSERTABLE.map((block) => ({
        id: block.kind,
        label: t(block.label),
        icon: block.icon,
        run: () => void insertAtCursor(view, block.kind, options),
      })),
    },
  ]
}

/**
 * Replaces the browser's context menu inside the editor with the app's, which
 * adds "Insert" to cut, copy and paste. The native menu has little else to
 * offer here (the editor turns spellcheck off), and Shift+right-click still
 * opens it. Touch long-presses are left alone: on a phone they select text.
 */
export function editorContextMenu(options: InsertOptions) {
  return EditorView.domEventHandlers({
    contextmenu(event, view) {
      if (event.shiftKey || view.state.readOnly) return false
      if ((event as PointerEvent).pointerType === 'touch') return false
      // Keyboard-triggered events (Shift+F10, Menu key) report (0, 0): anchor to the cursor.
      const fromKeyboard = event.clientX === 0 && event.clientY === 0
      // Right-clicking outside the selection moves the cursor there first, like a text field.
      const pos = fromKeyboard ? null : view.posAtCoords({ x: event.clientX, y: event.clientY })
      const inSelection = view.state.selection.ranges.some(
        (r) => pos !== null && pos >= r.from && pos <= r.to,
      )
      if (pos !== null && !inSelection) view.dispatch({ selection: { anchor: pos } })
      const caret = fromKeyboard ? view.coordsAtPos(view.state.selection.main.head) : null
      const at = caret ? { x: caret.left, y: caret.bottom } : { x: event.clientX, y: event.clientY }
      event.preventDefault()
      menu.open(editorMenuItems(view, options), at)
      return true
    },
  })
}
