import { describe, expect, it } from 'vitest'
import { EditorState, type TransactionSpec } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  blocksOf,
  deleteBlock,
  duplicateBlock,
  moveBlock,
  moveBlockBefore,
  turnBlockInto,
} from '$lib/editor/cm/blocks/model'

function state(doc: string) {
  return EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage })] })
}

function apply(s: EditorState, spec: TransactionSpec | null) {
  if (!spec) return s.doc.toString()
  return s.update(spec).state.doc.toString()
}

const DOC = '# Title\n\nFirst paragraph.\n\n- one\n- two\n\nLast.'

describe('block model', () => {
  it('splits a note into top-level blocks, one per list item', () => {
    const s = state(DOC)
    const texts = blocksOf(s).map((b) => s.sliceDoc(b.from, b.to))
    expect(texts).toEqual(['# Title', 'First paragraph.', '- one', '- two', 'Last.'])
    expect(blocksOf(s).map((b) => b.kind)).toEqual(['h1', 'text', 'bullet', 'bullet', 'text'])
  })

  it('moves blocks up and down, keeping their spacing', () => {
    const s = state(DOC)
    const [, paragraph, one, two] = blocksOf(s)
    expect(apply(s, moveBlock(s, paragraph!, -1))).toBe(
      'First paragraph.\n\n# Title\n\n- one\n- two\n\nLast.',
    )
    expect(apply(s, moveBlock(s, one!, 1))).toBe('# Title\n\nFirst paragraph.\n\n- two\n- one\n\nLast.')
    expect(moveBlock(s, blocksOf(s)[0]!, -1)).toBeNull()
    void two
  })

  it('drags a block before another one', () => {
    const s = state('A\n\nB\n\nC')
    const [a, b, c] = blocksOf(s)
    expect(apply(s, moveBlockBefore(s, c!, a!))).toBe('C\n\nA\n\nB')
    expect(apply(s, moveBlockBefore(s, a!, c!))).toBe('B\n\nA\n\nC')
    expect(apply(s, moveBlockBefore(s, a!, null))).toBe('B\n\nC\n\nA')
    expect(moveBlockBefore(s, b!, b!)).toBeNull()
  })

  it('duplicates and deletes', () => {
    const s = state('- a\n- b')
    const [a] = blocksOf(s)
    expect(apply(s, duplicateBlock(s, a!))).toBe('- a\n- a\n- b')
    expect(apply(s, deleteBlock(s, a!))).toBe('- b')
  })

  it('turns a block into another kind', () => {
    const s = state('Plain text\n\n- item\n  nested')
    const [text, item] = blocksOf(s)
    expect(apply(s, turnBlockInto(s, text!, 'h2'))).toBe('## Plain text\n\n- item\n  nested')
    expect(apply(s, turnBlockInto(s, item!, 'task'))).toBe('Plain text\n\n- [ ] item\n  nested')
  })
})
