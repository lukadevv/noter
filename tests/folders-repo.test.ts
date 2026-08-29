import { describe, expect, it } from 'vitest'
import { buildTree, flattenTree, isAncestor } from '$lib/db/repo/folders'
import { ROOT, type Folder } from '$lib/db/schema'

function folder(id: string, parentId: string, order: number, collapsed = false): Folder {
  return {
    id,
    name: id,
    parentId,
    icon: 'lucide:folder',
    color: null,
    order,
    collapsed,
    encrypted: 0,
    kdf: null,
    verifier: null,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('folder tree', () => {
  it('nests children under their parents in order', () => {
    const tree = buildTree([
      folder('b', ROOT, 2000),
      folder('a', ROOT, 1000),
      folder('a2', 'a', 2000),
      folder('a1', 'a', 1000),
    ])

    expect(tree.map((n) => n.id)).toEqual(['a', 'b'])
    expect(tree[0]!.children.map((n) => n.id)).toEqual(['a1', 'a2'])
    expect(tree[0]!.children[0]!.depth).toBe(1)
  })

  it('re-attaches orphans to the root rather than dropping them', () => {
    const tree = buildTree([folder('lost', 'missing-parent', 1000)])
    expect(tree.map((n) => n.id)).toEqual(['lost'])
  })

  it('skips children of collapsed folders when flattening', () => {
    const tree = buildTree([folder('a', ROOT, 1000, true), folder('a1', 'a', 1000)])
    expect(flattenTree(tree).map((n) => n.id)).toEqual(['a'])
    expect(flattenTree(tree, false).map((n) => n.id)).toEqual(['a', 'a1'])
  })
})

describe('isAncestor', () => {
  const folders = [folder('a', ROOT, 1000), folder('b', 'a', 1000), folder('c', 'b', 1000)]

  it('detects transitive ancestry', () => {
    expect(isAncestor(folders, 'a', 'c')).toBe(true)
    expect(isAncestor(folders, 'b', 'c')).toBe(true)
  })

  it('treats a folder as its own ancestor, blocking self-drops', () => {
    expect(isAncestor(folders, 'a', 'a')).toBe(true)
  })

  it('returns false for unrelated folders', () => {
    expect(isAncestor(folders, 'c', 'a')).toBe(false)
  })
})
