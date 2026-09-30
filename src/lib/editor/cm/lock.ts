import { Compartment, EditorState, type Extension } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

/**
 * Locking a note against accidental edits.
 *
 * The editor stays focusable and selectable while locked — you can still read,
 * search, copy and tick checkboxes — only typing, pasting and dropping are
 * refused. `EditorView.editable(false)` would be simpler but makes the content
 * unfocusable, so keystrokes never arrive and the user gets no hint about why
 * nothing happens. `inputmode=none` keeps a phone's keyboard from opening.
 */
export const lockCompartment = new Compartment()

export function lockExtension(locked: boolean): Extension {
  return [
    EditorState.readOnly.of(locked),
    EditorView.contentAttributes.of(locked ? { inputmode: 'none', 'aria-readonly': 'true' } : {}),
  ]
}

/** Calls `onBlocked` whenever the user tries to change a locked note. */
export function lockGuard(onBlocked: () => void): Extension {
  const blocked = (view: EditorView) => {
    if (!view.state.readOnly) return false
    onBlocked()
    return true
  }
  return EditorView.domEventHandlers({
    beforeinput: (_event, view) => blocked(view),
    paste: (event, view) => {
      if (!blocked(view)) return false
      event.preventDefault()
      return true
    },
    drop: (event, view) => {
      if (!blocked(view)) return false
      event.preventDefault()
      return true
    },
    keydown: (event, view) => {
      if (!view.state.readOnly) return false
      const printable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey
      if (printable || event.key === 'Enter' || event.key === 'Backspace' || event.key === 'Delete') {
        onBlocked()
      }
      return false
    },
  })
}
