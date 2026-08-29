import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  keymap,
  lineNumbers,
  placeholder as placeholderExt,
  rectangularSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { search, searchKeymap } from '@codemirror/search'
import { editorTheme, markdownHighlight } from './theme'
import { taskCheckboxes } from './tasks'
import { imageInput, inlineImages, type PasteHandlers } from './images'
import { noterCompletion, wikiLinkHighlight, type CompletionSources } from './wikilinks'

export interface EditorOptions {
  doc: string
  placeholder?: string
  lineNumbers?: boolean
  onChange: (doc: string) => void
  /** Called on blur and on unmount, so callers can force a save. */
  onFlush?: () => void
  /** Handles pasted and dropped images and URLs. */
  images?: PasteHandlers
  /** Live sources for `[[link]]` and `#tag` completion. */
  completion?: CompletionSources
}

/**
 * This module is imported dynamically: CodeMirror is the single heaviest
 * dependency in the app, and a user who only reads notes should never download
 * it. Everything editor-related must stay behind this boundary.
 */
export function createEditor(parent: HTMLElement, options: EditorOptions): EditorView {
  const extensions: Extension[] = [
    history(),
    drawSelection(),
    dropCursor(),
    rectangularSelection(),
    highlightActiveLine(),
    indentOnInput(),
    bracketMatching(),
    search({ top: true }),
    markdown(),
    markdownHighlight,
    taskCheckboxes,
    inlineImages,
    wikiLinkHighlight,
    editorTheme,
    EditorView.lineWrapping,
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) options.onChange(update.state.doc.toString())
    }),
    EditorView.domEventHandlers({
      blur: () => {
        options.onFlush?.()
        return false
      },
    }),
  ]

  if (options.placeholder) extensions.push(placeholderExt(options.placeholder))
  if (options.lineNumbers) extensions.push(lineNumbers())
  if (options.images) extensions.push(imageInput(options.images))
  if (options.completion) extensions.push(noterCompletion(options.completion))

  return new EditorView({
    parent,
    state: EditorState.create({ doc: options.doc, extensions }),
  })
}

/**
 * Replaces the whole document without touching the undo history's cursor
 * mapping. Used when the user switches to a different note.
 */
export function setDoc(view: EditorView, doc: string): void {
  if (view.state.doc.toString() === doc) return
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: doc },
    selection: { anchor: 0 },
    scrollIntoView: true,
  })
}

export type { EditorView }
