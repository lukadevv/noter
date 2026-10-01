// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { closeLink } from '$lib/editor/cm/wikilinks'

let view: EditorView | null = null

afterEach(() => {
  view?.destroy()
  view = null
})

/** Accepts "Ideas de marketing" over the half-typed title after `[[`. */
function accept(doc: string, cursor = doc.length): { doc: string; cursor: number } {
  view = new EditorView({
    state: EditorState.create({ doc, selection: { anchor: cursor } }),
    parent: document.body,
  })
  const from = doc.lastIndexOf('[[') + 2
  closeLink(view, { label: 'Ideas de marketing' }, from, cursor)
  return { doc: view.state.doc.toString(), cursor: view.state.selection.main.head }
}

describe('wiki link completion', () => {
  it('closes the link and puts the cursor after it', () => {
    const result = accept('See [[Ide')
    expect(result.doc).toBe('See [[Ideas de marketing]]')
    expect(result.cursor).toBe(result.doc.length)
  })

  it('reuses closing brackets that are already there', () => {
    const result = accept('See [[Ide]] later', 'See [[Ide'.length)
    expect(result.doc).toBe('See [[Ideas de marketing]] later')
    expect(result.cursor).toBe('See [[Ideas de marketing]]'.length)
  })
})
