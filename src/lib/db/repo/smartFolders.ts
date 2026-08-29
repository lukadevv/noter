import { db } from '../db'
import { now, type IconRef, type SmartFolder } from '../schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast } from '$lib/utils/order'

export async function allSmartFolders(): Promise<SmartFolder[]> {
  return db.smartFolders.orderBy('order').toArray()
}

export async function createSmartFolder(input: {
  name: string
  query: string
  icon?: IconRef
  color?: string | null
}): Promise<SmartFolder> {
  const existing = await allSmartFolders()
  const ts = now()
  const folder: SmartFolder = {
    id: uuid(),
    name: input.name.trim() || 'Saved search',
    query: input.query,
    icon: input.icon ?? 'lucide:search',
    color: input.color ?? null,
    order: orderAfterLast(existing),
    createdAt: ts,
    updatedAt: ts,
  }
  await db.smartFolders.add(folder)
  return folder
}

export async function updateSmartFolder(id: string, patch: Partial<SmartFolder>): Promise<void> {
  await db.smartFolders.update(id, { ...patch, updatedAt: now() })
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await db.smartFolders.delete(id)
}

/** Searches people reach for often enough to be worth offering up front. */
export const SUGGESTED_SEARCHES: { name: string; query: string; icon: IconRef }[] = [
  { name: 'Unfinished tasks', query: 'is:todo', icon: 'lucide:check-square' },
  { name: 'Recently edited', query: 'modified:<7d', icon: 'lucide:pencil' },
  { name: 'With images', query: 'has:image', icon: 'lucide:image' },
  { name: 'Pinned', query: 'is:pinned', icon: 'lucide:pin' },
]
