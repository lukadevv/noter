import { db } from '../db'
import { now, type Asset } from '../schema'
import { uuid } from '$lib/utils/uuid'
import { encodeImage } from '$lib/images/compress'
import { hashBlob } from '$lib/images/hash'

export interface StoreImageOptions {
  origin: Asset['origin']
  sourceUrl?: string | null
}

/**
 * Stores an image, reusing an identical one if it is already here.
 *
 * Deduplication is on the hash of the *original* bytes, so pasting the same
 * screenshot into ten notes costs one copy — a common enough habit that it is
 * worth the extra digest.
 */
export async function storeImage(source: Blob, options: StoreImageOptions): Promise<Asset> {
  const hash = await hashBlob(source)
  const existing = await db.assets.where('hash').equals(hash).first()
  if (existing) return existing

  const encoded = await encodeImage(source)
  const asset: Asset = {
    id: uuid(),
    hash,
    blob: encoded.blob,
    thumb: encoded.thumb,
    mime: encoded.mime,
    width: encoded.width,
    height: encoded.height,
    bytes: encoded.blob.size,
    origin: options.origin,
    sourceUrl: options.sourceUrl ?? null,
    createdAt: now(),
  }
  await db.assets.add(asset)
  return asset
}

export async function getAsset(id: string): Promise<Asset | undefined> {
  return db.assets.get(id)
}

export async function deleteAsset(id: string): Promise<void> {
  await db.assets.delete(id)
}

/** Matches every `![[img:<id>]]` reference in a note body. */
export const IMAGE_REF = /!\[\[img:([0-9a-f-]{36})\]\]/g

export function referencedAssetIds(body: string): string[] {
  return [...body.matchAll(IMAGE_REF)].map((match) => match[1]!)
}

/**
 * Deletes assets no note or snapshot references any more.
 *
 * Trashed notes still count as references: emptying the trash is what actually
 * frees their images, so a restore never comes back with broken pictures.
 * Encrypted notes cannot be read here, so they contribute the `assetRefs` list
 * written alongside their ciphertext. An encrypted note from before that list
 * existed makes the whole sweep stand down: deleting an image it might use is
 * data loss, keeping a stray one costs a few kilobytes.
 */
export async function purgeOrphanAssets(): Promise<number> {
  const [notes, versions, assets] = await Promise.all([
    db.notes.toArray(),
    db.versions.toArray(),
    db.assets.toArray(),
  ])

  const referenced = new Set<string>()
  for (const note of notes) {
    if (note.encrypted) {
      if (!note.assetRefs) return 0
      for (const id of note.assetRefs) referenced.add(id)
      continue
    }
    for (const id of referencedAssetIds(note.body)) referenced.add(id)
  }
  // Snapshots keep their images alive so restoring history never breaks them.
  // Encrypted snapshots belong to an encrypted note whose refs are counted above.
  for (const version of versions) {
    for (const id of referencedAssetIds(version.body)) referenced.add(id)
  }

  const orphans = assets.filter((asset) => !referenced.has(asset.id))
  if (orphans.length > 0) {
    await db.assets.bulkDelete(orphans.map((a) => a.id))
  }
  return orphans.length
}

export async function assetStorageUsed(): Promise<{ count: number; bytes: number }> {
  const assets = await db.assets.toArray()
  return {
    count: assets.length,
    bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
  }
}
