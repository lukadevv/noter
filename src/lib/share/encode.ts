import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import type { Note, ViewMode } from '$lib/db/schema'
import { derivedTitle } from '$lib/db/repo/notes'
import { referencedAssetIds } from '$lib/db/repo/assets'

/**
 * Sharing a note without a server.
 *
 * The note is compressed into the URL fragment. Fragments are never sent to a
 * server — not even to the host serving the app — so a shared link travels only
 * through whatever channel the sender chose, and there is nothing on our side to
 * store, expire or leak.
 *
 * **Images are never included.** Even as thumbnails they dominate the payload,
 * and a link that chat apps and browsers truncate is worse than one that is
 * honest about carrying text only. That makes this module pure: it reads nothing
 * from the database, so a link can be built synchronously.
 */

/** Beyond this the link stops being reliably shareable. */
export const MAX_URL_LENGTH = 8000

export interface SharePayload {
  v: 1
  t: string
  b: string
  m: ViewMode
  /**
   * Images inlined as data URLs. Never produced any more, but still decoded, so
   * a link made by an older build keeps working.
   */
  i?: Record<string, string>
}

export interface EncodeResult {
  payload: string
  length: number
  tooLong: boolean
  /** How many images the note references, none of which travel in the link. */
  imagesOmitted: number
}

export function encodeNote(note: Pick<Note, 'title' | 'body' | 'view'>): EncodeResult {
  const payload = compressToEncodedURIComponent(
    JSON.stringify({
      v: 1,
      t: derivedTitle(note),
      b: note.body,
      m: note.view,
    } satisfies SharePayload),
  )

  return {
    payload,
    length: payload.length,
    tooLong: payload.length > MAX_URL_LENGTH,
    imagesOmitted: referencedAssetIds(note.body).length,
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
 * Rewrites `![[img:id]]` references to any data URLs the payload happens to
 * carry. Current links carry none; this keeps older ones rendering.
 */
export function inlineSharedImages(body: string, images: Record<string, string> | undefined): string {
  if (!images) return body
  return body.replace(/!\[\[img:([0-9a-f-]{36})\]\]/g, (match, id: string) => {
    const url = images[id]
    return url ? `![](${url})` : match
  })
}
