import type { EditorView } from '@codemirror/view'
import { BLOCKS, insertionFor, type BlockKind } from '$lib/md/blocks'
import { t } from '$lib/i18n/index.svelte'

export interface InsertOptions {
  /** Opens a file picker and returns `![[img:…]]` references for the chosen images. */
  pickImages?: () => Promise<string[]>
}

/** Every kind the insert bar and menus offer; plain text is what typing already makes. */
export const INSERTABLE = BLOCKS.filter((block) => block.kind !== 'text')

/**
 * Inserts a block in place of `from`-`to` (the `/query`, or an empty range at
 * the cursor). Blocks that must stand alone (fences, tables, dividers) get a
 * blank line before and after, so they never merge into the paragraph around
 * them and the cursor can always get past them.
 */
export async function insertBlock(
  view: EditorView,
  kind: BlockKind,
  from: number,
  to: number,
  options: InsertOptions,
): Promise<void> {
  const { state } = view
  const line = state.doc.lineAt(from)
  const before = state.doc.sliceString(line.from, from)
  const after = state.doc.sliceString(to, line.to)
  const insertion = insertionFor(kind, {
    columns: [t('board.columns.todo'), t('board.columns.doing'), t('board.columns.done')],
    now: new Date(),
  })

  if (kind === 'image') {
    if (from !== to) view.dispatch({ changes: { from, to, insert: '' } })
    const refs = (await options.pickImages?.()) ?? []
    if (refs.length === 0) return
    const at = view.state.selection.main.head
    view.dispatch({
      changes: { from: at, insert: refs.join('\n') },
      selection: { anchor: at + refs.join('\n').length },
    })
    return
  }

  if (!insertion.standalone) {
    view.dispatch({
      changes: { from, to, insert: insertion.text },
      selection: { anchor: from + insertion.cursor },
      userEvent: 'input.complete',
    })
    return
  }

  // Standalone: replace the whole line when it only held the command.
  const lineBlank = !before.trim() && !after.trim()
  const start = lineBlank ? line.from : from
  const end = lineBlank ? line.to : to
  const lead =
    start > 0 && !lineBlank ? '\n\n' : start > 0 && state.doc.lineAt(start - 1).text.trim() ? '\n' : ''
  const nextLine = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null
  const tail = nextLine && !nextLine.text.trim() ? '' : '\n'
  const text = `${lead}${insertion.text}\n${tail}`
  view.dispatch({
    changes: { from: start, to: end, insert: text },
    selection: { anchor: start + lead.length + insertion.cursor },
    userEvent: 'input.complete',
  })

  if (kind === 'gallery') {
    const refs = (await options.pickImages?.()) ?? []
    if (refs.length === 0) return
    // The empty fence's middle line is where the images go.
    const inner = start + lead.length + insertion.text.indexOf('\n') + 1
    view.dispatch({ changes: { from: inner, insert: refs.join('\n') } })
  }
}

/**
 * Inserts a block at the cursor, for the insert bar and the context menu.
 *
 * Line blocks (a heading, a checklist item) start with their own markup, so on
 * a line that already has text they go on a new line below it instead of
 * turning "milk" into "milk- [ ] ". A selection is kept, not replaced: clicking
 * a button should never delete what the user had selected.
 */
export async function insertAtCursor(
  view: EditorView,
  kind: BlockKind,
  options: InsertOptions,
): Promise<void> {
  if (view.state.readOnly) return
  const head = view.state.selection.main.head
  const line = view.state.doc.lineAt(head)
  let at = head
  if (line.text.trim() && kind !== 'image' && kind !== 'date') {
    view.dispatch({ changes: { from: line.to, insert: '\n' }, selection: { anchor: line.to + 1 } })
    at = line.to + 1
  }
  view.focus()
  await insertBlock(view, kind, at, at, options)
}
