import { getAsset } from '$lib/db/repo/assets'

/**
 * Object-URL cache for stored images.
 *
 * Creating a URL per render would leak one entry per paint, and revoking eagerly
 * would break images that are still on screen. Instead URLs are cached by asset
 * id and evicted least-recently-used, which keeps a long session bounded without
 * ever pulling a URL out from under a visible <img>.
 */
const MAX_ENTRIES = 300

interface Entry {
  url: string
  usedAt: number
}

const cache = new Map<string, Entry>()
const pending = new Map<string, Promise<string | null>>()

function evictIfNeeded(): void {
  if (cache.size <= MAX_ENTRIES) return
  const entries = [...cache.entries()].sort((a, b) => a[1].usedAt - b[1].usedAt)
  for (const [id, entry] of entries.slice(0, cache.size - MAX_ENTRIES)) {
    URL.revokeObjectURL(entry.url)
    cache.delete(id)
  }
}

/** Resolves an asset id to a blob URL, or null when the asset is gone. */
export function assetUrl(id: string, variant: 'full' | 'thumb' = 'full'): Promise<string | null> {
  const key = `${variant}:${id}`
  const cached = cache.get(key)
  if (cached) {
    cached.usedAt = Date.now()
    return Promise.resolve(cached.url)
  }

  const inFlight = pending.get(key)
  if (inFlight) return inFlight

  const promise = getAsset(id)
    .then((asset) => {
      if (!asset) return null
      const url = URL.createObjectURL(variant === 'thumb' ? asset.thumb : asset.blob)
      cache.set(key, { url, usedAt: Date.now() })
      evictIfNeeded()
      return url
    })
    .finally(() => pending.delete(key))

  pending.set(key, promise)
  return promise
}

/** Drops cached URLs for an asset that has been deleted. */
export function forgetAsset(id: string): void {
  for (const variant of ['full', 'thumb'] as const) {
    const key = `${variant}:${id}`
    const entry = cache.get(key)
    if (entry) {
      URL.revokeObjectURL(entry.url)
      cache.delete(key)
    }
  }
}

export function clearAssetUrls(): void {
  for (const entry of cache.values()) URL.revokeObjectURL(entry.url)
  cache.clear()
}
