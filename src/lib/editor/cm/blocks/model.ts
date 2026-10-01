import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import type { EditorState, TransactionSpec } from '@codemirror/state'
import { kindOfLine, turnLinesInto, type BlockKind } from '$lib/md/blocks'

/**
 * Top-level blocks of a note, as the block handle sees them.
 *
 * A block is a paragraph, heading, quote, fence, table… - a top-level node of
 * the markdown syntax tree, widened to whole lines. Each item of a top-level
 * list is its own block (with its nested lines), because moving "one bullet"
 * is what people mean, not moving the whole list.
 *
 * Everything here maps an EditorState to a TransactionSpec and touches no DOM,
 * so it is unit-tested directly.
 */
export interface Block {
  from: number
  to: number
  kind: BlockKind | 'fence' | 'other'
}

const LISTS = new Set(['BulletList', 'OrderedList'])

export function blocksOf(state: EditorState, upTo = state.doc.length): Block[] {
  const tree = ensureSyntaxTree(state, upTo, 200) ?? syntaxTree(state)
  const blocks: Block[] = []
  const cursor = tree.topNode.cursor()
  if (!cursor.firstChild()) return blocks
  do {
    if (LISTS.has(cursor.name)) {
      const list = cursor.node
      for (let item = list.firstChild; item; item = item.nextSibling) {
        if (item.name !== 'ListItem') continue
        blocks.push(lineBlock(state, item.from, item.to))
      }
    } else if (cursor.name !== 'Comment') {
      blocks.push(
        lineBlock(state, cursor.from, cursor.to, cursor.name === 'FencedCode' ? 'fence' : undefined),
      )
    }
  } while (cursor.nextSibling())
  return blocks
}

function lineBlock(state: EditorState, from: number, to: number, kind?: Block['kind']): Block {
  const start = state.doc.lineAt(from)
  // A node can end on the newline after its last line; stay on that last line.
  const end = state.doc.lineAt(
    Math.max(from, to > from && state.doc.sliceString(to - 1, to) === '\n' ? to - 1 : to),
  )
  return { from: start.from, to: end.to, kind: kind ?? kindOfLine(start.text) }
}

export function blockAt(state: EditorState, pos: number): Block | null {
  const blocks = blocksOf(state, Math.min(state.doc.length, pos + 2000))
  return blocks.find((b) => pos >= b.from && pos <= b.to) ?? null
}

function neighbours(state: EditorState, block: Block) {
  const blocks = blocksOf(state)
  const index = blocks.findIndex((b) => b.from === block.from)
  return { blocks, index }
}

/** Swaps a block with the one above (-1) or below (+1), keeping the spacing between them. */
export function moveBlock(state: EditorState, block: Block, direction: -1 | 1): TransactionSpec | null {
  const { blocks, index } = neighbours(state, block)
  const other = blocks[index + direction]
  if (index < 0 || !other) return null
  const [first, second] = direction < 0 ? [other, block] : [block, other]
  const between = state.sliceDoc(first.to, second.from)
  const text = state.sliceDoc(second.from, second.to) + between + state.sliceDoc(first.from, first.to)
  const movedStart = direction < 0 ? first.from : first.from + (second.to - second.from) + between.length
  return {
    changes: { from: first.from, to: second.to, insert: text },
    selection: { anchor: movedStart },
    scrollIntoView: true,
    userEvent: 'move.block',
  }
}

/** Moves a block so it starts where `target` starts (or to the end when target is null). */
export function moveBlockBefore(
  state: EditorState,
  block: Block,
  target: Block | null,
): TransactionSpec | null {
  const { blocks, index } = neighbours(state, block)
  if (index < 0) return null
  const next = blocks[index + 1]
  const prev = blocks[index - 1]
  // Dropping onto itself, or just below itself, changes nothing.
  if (target && (target.from === block.from || target.from === next?.from)) return null
  if (!target && !next) return null

  // The block leaves together with the gap after it (or before it, if last).
  const [removeFrom, removeTo] = next ? [block.from, next.from] : [prev ? prev.to : block.from, block.to]
  const gap = next ? state.sliceDoc(block.to, next.from) : prev ? state.sliceDoc(prev.to, block.from) : '\n'
  const separator = gap.includes('\n\n') ? '\n\n' : '\n'
  const text = state.sliceDoc(block.from, block.to)

  const insert = target
    ? { from: target.from, insert: text + separator }
    : { from: state.doc.length, insert: separator + text }
  return {
    changes: [insert, { from: removeFrom, to: removeTo }],
    userEvent: 'move.drop',
    scrollIntoView: true,
  }
}

export function duplicateBlock(state: EditorState, block: Block): TransactionSpec {
  const text = state.sliceDoc(block.from, block.to)
  const separator =
    block.kind === 'bullet' || block.kind === 'numbered' || block.kind === 'task' ? '\n' : '\n\n'
  return {
    changes: { from: block.to, insert: separator + text },
    selection: { anchor: block.to + separator.length },
    userEvent: 'input.duplicate',
  }
}

export function deleteBlock(state: EditorState, block: Block): TransactionSpec {
  const to = block.to < state.doc.length ? block.to + 1 : block.to
  const from = block.to >= state.doc.length && block.from > 0 ? block.from - 1 : block.from
  return { changes: { from, to }, userEvent: 'delete.block' }
}

/**
 * Rewrites a block as another kind. Nested lines of a list item (more indented
 * than its first line) are left as they are.
 */
export function turnBlockInto(state: EditorState, block: Block, kind: BlockKind): TransactionSpec | null {
  if (block.kind === 'fence' || block.kind === 'other') return null
  const lines = state.sliceDoc(block.from, block.to).split('\n')
  const baseIndent = /^\s*/.exec(lines[0]!)![0].length
  let own = lines.length
  for (let i = 1; i < lines.length; i++) {
    if (/^\s*/.exec(lines[i]!)![0].length > baseIndent && block.kind !== 'text') {
      own = i
      break
    }
  }
  const converted = [...turnLinesInto(lines.slice(0, own), kind), ...lines.slice(own)].join('\n')
  return {
    changes: { from: block.from, to: block.to, insert: converted },
    selection: { anchor: block.from + converted.split('\n')[0]!.length },
    userEvent: 'input.turninto',
  }
}
