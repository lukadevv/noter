import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import { BLOCKS, insertionFor, type BlockKind } from '$lib/md/blocks'
import { t } from '$lib/i18n/index.svelte'

export interface SlashOptions {
  /** Opens a file picker and returns `![[img:…]]` references for the chosen images. */
  pickImages?: () => Promise<string[]>
}

/** A short glyph per block, shown before its name in the menu. */
const GLYPHS: Record<BlockKind, string> = {
  text: 'T',
  h1: 'H1',
  h2: 'H2',
  h3: 'H3',
  task: '☑',
  bullet: '•',
  numbered: '1.',
  quote: '❝',
  callout: 'ℹ',
  code: '</>',
  board: '▦',
  gallery: '▣',
  image: '◩',
  table: '⊞',
  divider: '-',
  date: '◷',
}

/**
 * Inserts a block where the `/query` was typed. Blocks that must stand alone
 * (fences, tables, dividers) get a blank line before and after, so they never
 * merge into the paragraph around them and the cursor can always get past them.
 */
async function insertBlock(
  view: EditorView,
  kind: BlockKind,
  from: number,
  to: number,
  options: SlashOptions,
) {
  const { state } = view
  const line = state.doc.lineAt(from)
  const before = state.doc.sliceString(line.from, from)
  const after = state.doc.sliceString(to, line.to)
  const insertion = insertionFor(kind, {
    columns: [t('board.columns.todo'), t('board.columns.doing'), t('board.columns.done')],
    now: new Date(),
  })

  if (kind === 'image') {
    view.dispatch({ changes: { from, to, insert: '' } })
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
 * The `/` menu: type a slash at the start of a line (or after a space) to
 * insert any kind of block. Matches the block names in the current language
 * and a few English aliases, so "/todo" and "/tarea" both find checklists.
 */
export function slashCompletions(options: SlashOptions) {
  return function complete(context: CompletionContext): CompletionResult | null {
    const match = context.matchBefore(/(?:^|\s)\/[\p{L}\p{N}-]*$/u)
    if (!match) return null
    const slash = match.text.indexOf('/') + match.from
    const node = syntaxTree(context.state).resolveInner(slash, -1)
    for (let n: typeof node | null = node; n; n = n.parent) {
      if (n.name === 'FencedCode' || n.name === 'InlineCode' || n.name === 'CodeBlock') return null
    }

    const blocks: Completion[] = BLOCKS.map((block, index) => ({
      label: `/${t(block.label)}`,
      displayLabel: t(block.label),
      detail: GLYPHS[block.kind],
      type: 'block',
      boost: -index,
      apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
        void insertBlock(view, block.kind, from, to, options)
      },
    }))

    // The filter matches on `label`; aliases get their own hidden entries that
    // apply the same block, so "/todo" works in every language.
    const typed = context.state.sliceDoc(slash + 1, context.pos).toLowerCase()
    const extra: Completion[] = typed
      ? BLOCKS.flatMap((block) =>
          block.aliases
            .filter((alias) => alias.startsWith(typed) && !t(block.label).toLowerCase().startsWith(typed))
            .slice(0, 1)
            .map((alias) => ({
              label: `/${alias}`,
              displayLabel: t(block.label),
              detail: GLYPHS[block.kind],
              type: 'block',
              apply: (view: EditorView, _c: Completion, from: number, to: number) => {
                void insertBlock(view, block.kind, from, to, options)
              },
            })),
        )
      : []

    return {
      from: slash,
      options: [...blocks, ...extra],
      validFor: /^\/[\p{L}\p{N}-]*$/u,
    }
  }
}
