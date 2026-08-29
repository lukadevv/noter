import { db } from '../db'
import { ROOT, now, type Folder, type IconRef } from '../schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast, orderBetween } from '$lib/utils/order'

export interface FolderNode extends Folder {
  children: FolderNode[]
  depth: number
}

export async function allFolders(): Promise<Folder[]> {
  return db.folders.orderBy('order').toArray()
}

/**
 * Builds the folder tree. Folders whose parent no longer exists are re-attached
 * to the root instead of vanishing, so a botched delete can never hide data.
 */
export function buildTree(folders: Folder[]): FolderNode[] {
  const byId = new Map<string, FolderNode>()
  for (const f of folders) byId.set(f.id, { ...f, children: [], depth: 0 })

  const roots: FolderNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentId === ROOT ? undefined : byId.get(node.parentId)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortRec = (nodes: FolderNode[], depth: number) => {
    nodes.sort((a, b) => a.order - b.order)
    for (const n of nodes) {
      n.depth = depth
      sortRec(n.children, depth + 1)
    }
  }
  sortRec(roots, 0)
  return roots
}

/** Depth-first flattening that skips the children of collapsed folders. */
export function flattenTree(nodes: FolderNode[], respectCollapsed = true): FolderNode[] {
  const out: FolderNode[] = []
  const walk = (list: FolderNode[]) => {
    for (const n of list) {
      out.push(n)
      if (!respectCollapsed || !n.collapsed) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

export async function createFolder(
  input: { name: string; parentId?: string; icon?: IconRef; color?: string | null } = { name: 'New folder' },
): Promise<Folder> {
  const parentId = input.parentId ?? ROOT
  const siblings = await db.folders.where('parentId').equals(parentId).toArray()
  const ts = now()
  const folder: Folder = {
    id: uuid(),
    name: input.name.trim() || 'New folder',
    parentId,
    icon: input.icon ?? 'lucide:folder',
    color: input.color ?? null,
    order: orderAfterLast(siblings),
    collapsed: false,
    encrypted: 0,
    kdf: null,
    verifier: null,
    createdAt: ts,
    updatedAt: ts,
  }
  await db.folders.add(folder)
  return folder
}

export async function updateFolder(id: string, patch: Partial<Folder>): Promise<void> {
  await db.folders.update(id, { ...patch, updatedAt: now() })
}

/** Ids of a folder and every folder beneath it. */
export async function descendantIds(id: string): Promise<string[]> {
  const folders = await allFolders()
  const childrenOf = new Map<string, string[]>()
  for (const f of folders) {
    const list = childrenOf.get(f.parentId) ?? []
    list.push(f.id)
    childrenOf.set(f.parentId, list)
  }
  const out: string[] = []
  const walk = (current: string) => {
    out.push(current)
    for (const child of childrenOf.get(current) ?? []) walk(child)
  }
  walk(id)
  return out
}

/**
 * Deletes a folder subtree. Notes inside are moved to the trash rather than
 * destroyed, so a mis-click stays recoverable for the retention window.
 */
export async function deleteFolder(id: string): Promise<void> {
  const ids = await descendantIds(id)
  const ts = now()
  await db.transaction('rw', db.folders, db.notes, async () => {
    const notes = await db.notes.where('folderId').anyOf(ids).toArray()
    await db.notes.bulkPut(
      notes.map((n) => (n.deletedAt ? n : { ...n, folderId: ROOT, deletedAt: ts, updatedAt: ts })),
    )
    await db.folders.bulkDelete(ids)
  })
}

/** True when `maybeAncestor` is `id` itself or one of its ancestors. */
export function isAncestor(folders: Folder[], maybeAncestor: string, id: string): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]))
  let current: string | undefined = id
  while (current && current !== ROOT) {
    if (current === maybeAncestor) return true
    current = byId.get(current)?.parentId
  }
  return false
}

/**
 * Reparents and repositions a folder in one write. Dropping a folder into its
 * own subtree would orphan the branch, so that move is rejected.
 */
export async function moveFolder(
  id: string,
  parentId: string,
  before: string | null,
  after: string | null,
): Promise<boolean> {
  const folders = await allFolders()
  if (parentId !== ROOT && isAncestor(folders, id, parentId)) return false

  const byId = new Map(folders.map((f) => [f.id, f]))
  const order = orderBetween(
    before ? (byId.get(before)?.order ?? null) : null,
    after ? (byId.get(after)?.order ?? null) : null,
  )
  await updateFolder(id, { parentId, order })
  return true
}
