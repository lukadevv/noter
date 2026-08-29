import { storeImage } from '$lib/db/repo/assets'
import type { Asset } from '$lib/db/schema'

export type IngestResult =
  | { kind: 'stored'; asset: Asset; markdown: string }
  | { kind: 'external'; url: string; markdown: string; reason: string }
  | { kind: 'skipped'; reason: string }

/** Reference syntax for a locally stored image. */
export function imageMarkdown(assetId: string): string {
  return `![[img:${assetId}]]`
}

/** Refuses absurd inputs early, before a multi-hundred-megabyte decode. */
const MAX_SOURCE_BYTES = 40 * 1024 * 1024

export async function ingestBlob(blob: Blob, origin: Asset['origin'], sourceUrl?: string): Promise<IngestResult> {
  if (!blob.type.startsWith('image/')) {
    return { kind: 'skipped', reason: 'Not an image.' }
  }
  if (blob.size > MAX_SOURCE_BYTES) {
    return { kind: 'skipped', reason: 'Image is larger than 40 MB.' }
  }

  const asset = await storeImage(blob, { origin, sourceUrl: sourceUrl ?? null })
  return { kind: 'stored', asset, markdown: imageMarkdown(asset.id) }
}

export async function ingestFiles(files: Iterable<File>, origin: Asset['origin'] = 'file'): Promise<IngestResult[]> {
  const results: IngestResult[] = []
  for (const file of files) {
    results.push(await ingestBlob(file, origin))
  }
  return results
}

const IMAGE_URL = /^https?:\/\/\S+$/i

export function looksLikeUrl(text: string): boolean {
  return IMAGE_URL.test(text.trim())
}

/**
 * Downloads a remote image and stores it locally.
 *
 * Hotlinking would leak the reader's IP to the remote host every time the note
 * is opened, break when the URL rots, and fail offline — so the bytes are pulled
 * in once and kept. When CORS blocks the fetch (common on CDNs that do not send
 * the header) the URL is kept as a plain external reference and flagged as such,
 * which is honest about being fragile rather than silently dropping the paste.
 */
export async function ingestUrl(url: string): Promise<IngestResult> {
  const trimmed = url.trim()
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { kind: 'skipped', reason: 'Not a valid URL.' }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { kind: 'skipped', reason: 'Only http(s) URLs can be fetched.' }
  }

  try {
    const response = await fetch(trimmed, { mode: 'cors', credentials: 'omit', redirect: 'follow' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const blob = await response.blob()
    if (!blob.type.startsWith('image/')) {
      return { kind: 'skipped', reason: 'That URL is not an image.' }
    }
    return ingestBlob(blob, 'url', trimmed)
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'the request failed'
    return {
      kind: 'external',
      url: trimmed,
      markdown: `![](${trimmed})`,
      reason: `Could not download the image (${reason}); linking to it instead.`,
    }
  }
}

/** Pulls image files out of a clipboard or drag payload. */
export function imagesFrom(data: DataTransfer | null): File[] {
  if (!data) return []
  const files: File[] = []
  for (const item of data.files) {
    if (item.type.startsWith('image/')) files.push(item)
  }
  return files
}
