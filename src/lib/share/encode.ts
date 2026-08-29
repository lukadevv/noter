import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Note, ViewMode } from '$lib/db/schema'
import { derivedTitle } from '$lib/db/repo/notes'
import { getAsset } from '$lib/db/repo/assets'
import { referencedAssetIds } from '$lib/db/repo/assets'
import { bytesToBase64 } from '$lib/crypto/base64'

/**
 * Sharing a note without a server.
 *
 * The whole note is compressed into the URL fragment. Fragments are never sent
 * to a server — not even to the host serving the app — so a shared link travels
 * only through whatever channel the user chose, and there is nothing to store,
 * expire or leak on our side.
 *
 * The cost is size. Browsers and chat apps start truncating long URLs, so images
 * are only embedded while the result stays small, and the encoder says clearly
 * when it had to leave them out.
 */

/** Beyond this the link stops being reliably shareable. */
export const MAX_URL_LENGTH = 8000
/** Images are only inlined while the encoded payload stays under this. */
export const IMAGE_BUDGET = 30_000

export interface SharePayload {
  v: 1
  t: string
  b: string
  m: ViewMode
  /** Inlined images, as `id` to data URL. Absent when they did not fit. */
  i?: Record<string, string>
}

export interface EncodeResult {
  payload: string
  /** True when images were dropped to keep the link usable. */
  imagesOmitted: boolean
  length: number
  tooLong: boolean
}

async function inlineImages(ids: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  let budget = IMAGE_BUDGET

  for (const id of ids) {
    const asset = await getAsset(id)
    if (!asset) continue
    // Thumbnails, not originals: a shared link is for reading, and a full
    // screenshot would blow the budget on its own.
    const bytes = new Uint8Array(await asset.thumb.arrayBuffer())
    const encoded = `data:${asset.mime};base64,${bytesToBase64(bytes)}`
    if (encoded.length > budget) break
    budget -= encoded.length
    out[id] = encoded
  }

  return out
}

export async function encodeNote(note: Note, options: { includeImages?: boolean } = {}): Promise<EncodeResult> {
  const ids = referencedAssetIds(note.body)
  const wantsImages = options.includeImages !== false && ids.length > 0

  const base: SharePayload = {
    v: 1,
    t: derivedTitle(note),
    b: note.body,
    m: note.view,
  }

  let payload = compressToEncodedURIComponent(JSON.stringify(base))
  let imagesOmitted = wantsImages

  if (wantsImages) {
    const images = await inlineImages(ids)
    if (Object.keys(images).length > 0) {
      const withImages = compressToEncodedURIComponent(JSON.stringify({ ...base, i: images }))
      if (withImages.length <= MAX_URL_LENGTH) {
        payload = withImages
        imagesOmitted = Object.keys(images).length < ids.length
      }
    }
  }

  return {
    payload,
    imagesOmitted,
    length: payload.length,
    tooLong: payload.length > MAX_URL_LENGTH,
  }
}

export function decodeNote(payload: string): SharePayload | null {
  try {
    const json = decompressFromEncodedURIComponent(payload)
    if (!json) return null
    const parsed = JSON.parse(json) as Partial<SharePayload>
    // Shared payloads come from strangers: validate rather than trust.
    if (parsed.v !== 1 || typeof parsed.b !== 'string' || typeof parsed.t !== 'string') return null
    return {
      v: 1,
      t: parsed.t,
      b: parsed.b,
      m: (parsed.m as ViewMode) ?? 'doc',
      i: typeof parsed.i === 'object' && parsed.i !== null ? parsed.i : undefined,
    }
  } catch {
    return null
  }
}

export function shareUrl(payload: string): string {
  const base = `${location.origin}${location.pathname}`
  return `${base}#/s/${payload}`
}

/**
 * Rewrites `![[img:id]]` references to the data URLs carried in the payload, so
 * a shared note renders images without touching this app's database.
 */
export function inlineSharedImages(body: string, images: Record<string, string> | undefined): string {
  if (!images) return body
  return body.replace(/!\[\[img:([0-9a-f-]{36})\]\]/g, (match, id: string) => {
    const url = images[id]
    return url ? `![](${url})` : match
  })
}
