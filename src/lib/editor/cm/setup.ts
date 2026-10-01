import { Annotation, Compartment, EditorState, Transaction, type Extension } from '@codemirror/state'
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
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { search, searchKeymap } from '@codemirror/search'
import { codeHighlight, editorTheme, markdownHighlight } from './theme'
import { taskCheckboxes } from './tasks'
import { imageInput, inlineImages, type PasteHandlers } from './images'
import { linkCompletions, wikiLinkHighlight, wikiLinkClicks, type CompletionSources } from './wikilinks'
import { completions } from './completion'
import { slashCompletions } from './slash'
import { codeLanguages } from './code-languages'
import { livePreview } from './live/preview'
import { contentBlocks } from './blocks/fences.svelte'
import { blockHandle, blockKeymap } from './blocks/handle'
import { lockCompartment, lockExtension, lockGuard } from './lock'
import { minimalChange } from './diff'

export interface EditorOptions {
  /** The note shown first, so the editor starts on it rather than swapping to it. */
  noteId: string
  doc: string
  locked?: boolean
  placeholder?: string
  lineNumbers?: boolean
  onChange: (doc: string) => void
  /** Called on blur and on unmount, so callers can force a save. */
  onFlush?: () => void
  /** Called when the user tries to type into a locked note. */
  onBlocked?: () => void
  /** Follows a `[[wiki link]]` (Ctrl/⌘-click, or a plain click when locked). */
  onLink?: (target: string) => void
  /** Handles pasted and dropped images and URLs. */
  images?: PasteHandlers
  /** Live sources for `[[link]]` and `#tag` completion. */
  completion?: CompletionSources
  /** Opens a file picker and returns `![[img:…]]` references (image and gallery blocks). */
  pickImages?: () => Promise<string[]>
}

/** Marks changes that came from outside the editor (a history restore, a rename). */
const external = Annotation.define<boolean>()

/** How many notes keep their undo history and cursor while you switch around. */
const CACHE_SIZE = 20

/**
 * One CodeMirror instance for the whole app, switching between notes.
 *
 * Each note keeps its own `EditorState` in a small cache, so moving to another
 * note and back restores the cursor, scroll position and undo history - and,
 * just as important, undo in one note can never paste text from another, which
 * is what replacing the document in a single shared state would do.
 *
 * This module is imported dynamically: CodeMirror is the single heaviest
 * dependency in the app, and a user who only reads notes should never download
 * it. Everything editor-related must stay behind this boundary.
 */
export class NoteEditor {
  readonly view: EditorView
  #extensions: Extension[]
  #lineNumbers = new Compartment()
  #cache = new Map<string, { state: EditorState; scroll: ReturnType<EditorView['scrollSnapshot']> }>()
  #noteId: string | null = null
  #locked = false
  #showLineNumbers: boolean
  /** Documents this editor itself produced recently; echoes of them are not external changes. */
  #emitted: string[] = []
  /**
   * The text last handed in from outside. The caller may call `open` again with
   * the same, now stale, text (a component re-rendering before the store has
   * caught up with the latest keystroke); only a different value is news.
   */
  #incoming = ''

  constructor(parent: HTMLElement, options: EditorOptions) {
    this.#showLineNumbers = options.lineNumbers ?? false
    this.#extensions = [
      history(),
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      highlightActiveLine(),
      indentOnInput(),
      bracketMatching(),
      search({ top: true }),
      // GFM (tables, task lists, strikethrough) plus highlighting inside code blocks.
      markdown({ base: markdownLanguage, codeLanguages }),
      markdownHighlight,
      codeHighlight,
      livePreview,
      taskCheckboxes,
      inlineImages,
      wikiLinkHighlight,
      contentBlocks({ pickImages: () => options.pickImages?.() ?? Promise.resolve([]) }),
      blockHandle,
      editorTheme,
      EditorView.lineWrapping,
      blockKeymap,
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return
        if (update.transactions.some((tr) => tr.annotation(external))) return
        const doc = update.state.doc.toString()
        this.#remember(doc)
        options.onChange(doc)
      }),
      EditorView.domEventHandlers({
        blur: () => {
          options.onFlush?.()
          return false
        },
      }),
      lockCompartment.of(lockExtension(false)),
      this.#lineNumbers.of(this.#showLineNumbers ? lineNumbers() : []),
    ]
    if (options.placeholder) this.#extensions.push(placeholderExt(options.placeholder))
    if (options.images) this.#extensions.push(imageInput(options.images))
    // One autocompletion for everything: CodeMirror allows a single override list.
    this.#extensions.push(
      completions([
        ...(options.completion ? [linkCompletions(options.completion)] : []),
        slashCompletions({ pickImages: options.pickImages }),
      ]),
    )
    if (options.onBlocked) this.#extensions.push(lockGuard(options.onBlocked))
    if (options.onLink) this.#extensions.push(wikiLinkClicks(options.onLink))

    this.#noteId = options.noteId
    this.#incoming = options.doc
    this.#locked = options.locked ?? false
    this.view = new EditorView({ parent, state: this.#fresh(options.doc) })
    if (this.#locked) this.view.dispatch({ effects: lockCompartment.reconfigure(lockExtension(true)) })
  }

  #fresh(doc: string): EditorState {
    return EditorState.create({ doc, extensions: this.#extensions })
  }

  #remember(doc: string) {
    this.#emitted.push(doc)
    if (this.#emitted.length > 8) this.#emitted.shift()
  }

  /** Shows a note, restoring its cached state when the text still matches. */
  open(noteId: string, doc: string): void {
    if (noteId === this.#noteId) {
      this.sync(doc)
      return
    }
    if (this.#noteId) {
      this.#cache.delete(this.#noteId)
      this.#cache.set(this.#noteId, { state: this.view.state, scroll: this.view.scrollSnapshot() })
    }

    const cached = this.#cache.get(noteId)
    this.#noteId = noteId
    this.#emitted = []
    this.#incoming = doc
    if (cached && cached.state.doc.toString() === doc) {
      this.view.setState(cached.state)
      this.view.dispatch({ effects: cached.scroll })
    } else {
      // The text changed while the note was away (a rename rewrote a link, a
      // restore): start fresh rather than resurrect a stale undo history.
      this.view.setState(this.#fresh(doc))
    }
    this.#cache.delete(noteId)
    while (this.#cache.size > CACHE_SIZE) this.#cache.delete(this.#cache.keys().next().value!)

    // Cached states carry whatever configuration they had; bring it up to date.
    this.view.dispatch({
      effects: [
        lockCompartment.reconfigure(lockExtension(this.#locked)),
        this.#lineNumbers.reconfigure(this.#showLineNumbers ? lineNumbers() : []),
      ],
    })
  }

  /**
   * Applies a change made outside the editor as a minimal edit, so the cursor
   * and undo history survive, and the user can undo a restore like any edit.
   * Echoes of the editor's own recent output are ignored: an encrypted note's
   * store copy lags the editor, and "syncing" to it would undo fresh typing.
   */
  sync(doc: string): void {
    if (doc === this.#incoming) return
    this.#incoming = doc
    const current = this.view.state.doc.toString()
    if (current === doc || this.#emitted.includes(doc)) return
    const change = minimalChange(current, doc)
    this.view.dispatch({
      changes: change,
      annotations: [external.of(true), Transaction.addToHistory.of(true)],
    })
  }

  setLocked(locked: boolean): void {
    if (locked === this.#locked) return
    this.#locked = locked
    this.view.dispatch({ effects: lockCompartment.reconfigure(lockExtension(locked)) })
  }

  setLineNumbers(on: boolean): void {
    if (on === this.#showLineNumbers) return
    this.#showLineNumbers = on
    this.view.dispatch({ effects: this.#lineNumbers.reconfigure(on ? lineNumbers() : []) })
  }

  /** Forgets a note's cached state, e.g. after it was deleted. */
  forget(noteId: string): void {
    this.#cache.delete(noteId)
  }

  focus(): void {
    this.view.focus()
  }

  destroy(): void {
    this.view.destroy()
    this.#cache.clear()
  }
}

export function createEditor(parent: HTMLElement, options: EditorOptions): NoteEditor {
  return new NoteEditor(parent, options)
}

export type { EditorView }
