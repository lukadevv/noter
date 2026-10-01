import { describe, expect, it } from 'vitest'
import {
  hidden,
  isPending,
  lockRootOf,
  lockRoots,
  withParent,
  type LockFolder,
} from '$lib/crypto/lock-root'
import { ROOT, type Note } from '$lib/db/schema'

const kdf = { salt: 's', iterations: 1 }
const folder = (id: string, parentId: string, encrypted = false): LockFolder => ({
  id,
  parentId,
  encrypted: encrypted ? 1 : 0,
  kdf: encrypted ? kdf : null,
})

// A (locked) > B > C, and a separate plain tree P > Q.
const folders = [
  folder('A', ROOT, true),
  folder('B', 'A'),
  folder('C', 'B'),
  folder('P', ROOT),
  folder('Q', 'P'),
]

describe('lock roots', () => {
  it('protects everything below an encrypted folder with its key', () => {
    const roots = lockRoots(folders)
    expect(roots.get('A')).toBe('A')
    expect(roots.get('B')).toBe('A')
    expect(roots.get('C')).toBe('A')
  })

  it('leaves folders outside any encrypted tree alone', () => {
    const roots = lockRoots(folders)
    expect(roots.has('P')).toBe(false)
    expect(roots.has('Q')).toBe(false)
    expect(lockRootOf(folders, 'Q')).toBeNull()
  })

  it('lets a nested encrypted folder keep its own key', () => {
    const nested = [...folders.filter((f) => f.id !== 'C'), folder('C', 'B', true), folder('D', 'C')]
    const roots = lockRoots(nested)
    expect(roots.get('B')).toBe('A')
    expect(roots.get('C')).toBe('C')
    expect(roots.get('D')).toBe('C')
  })

  it('follows a folder that moves into or out of an encrypted tree', () => {
    expect(lockRootOf(withParent(folders, 'P', 'B'), 'Q')).toBe('A')
    expect(lockRootOf(withParent(folders, 'C', ROOT), 'C')).toBeNull()
  })

  it('ends on a parent cycle instead of looping', () => {
    const cyclic = [folder('X', 'Y'), folder('Y', 'X')]
    expect(lockRoots(cyclic).size).toBe(0)
  })

  it('treats an encrypted folder with no key material as unprotected', () => {
    const broken: LockFolder[] = [{ id: 'Z', parentId: ROOT, encrypted: 1, kdf: null }]
    expect(lockRoots(broken).size).toBe(0)
  })
})

describe('notes waiting for their folder key', () => {
  const roots = lockRoots(folders)
  const note = { encrypted: 0, folderId: 'C' } as Note

  it('flags a plaintext note inside a protected folder', () => {
    expect(isPending(note, roots)).toBe(true)
    expect(isPending({ ...note, encrypted: 1 }, roots)).toBe(false)
    expect(isPending({ ...note, folderId: 'Q' }, roots)).toBe(false)
  })

  it('hides every readable field', () => {
    const shown = hidden({ ...note, title: 'Secret', body: 'text', tags: ['x'] } as Note)
    expect(shown).toMatchObject({ encrypted: 1, title: '', body: '', tags: [] })
  })
})
