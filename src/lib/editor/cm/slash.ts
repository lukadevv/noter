import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { syntaxTree } from '@codemirror/language'
import type { EditorView } from '@codemirror/view'
import { BLOCKS, type BlockKind } from '$lib/md/blocks'
import { t } from '$lib/i18n/index.svelte'
import { insertBlock, type InsertOptions } from './insert'

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
 * The `/` menu: type a slash at the start of a line (or after a space) to
 * insert any kind of block. Matches the block names in the current language
 * and a few English aliases, so "/todo" and "/tarea" both find checklists.
 */
export function slashCompletions(options: InsertOptions) {
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
