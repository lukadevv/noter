/**
 * Image normalisation.
 *
 * A pasted screenshot is typically a 2-4 MB PNG. Storing it as-is would blow
 * through the origin's storage quota within a few dozen notes, so every image
 * that enters the app is re-encoded to WebP and capped on its longest edge, and
 * a small thumbnail is generated alongside it for lists and grids.
 */

/** Longest edge of the stored image, in CSS pixels. */
export const MAX_EDGE = 2400
/** Longest edge of the thumbnail. */
export const THUMB_EDGE = 320
export const QUALITY = 0.85
export const THUMB_QUALITY = 0.7

export interface EncodedImage {
  blob: Blob
  thumb: Blob
  width: number
  height: number
  mime: string
}

/** Formats that must survive untouched: re-encoding would destroy them. */
const PASSTHROUGH = new Set(['image/svg+xml', 'image/gif'])

function scaledSize(width: number, height: number, maxEdge: number): [number, number] {
  const longest = Math.max(width, height)
  if (longest <= maxEdge) return [width, height]
  const scale = maxEdge / longest
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))]
}

function canvasFor(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function toBlob(
  canvas: OffscreenCanvas | HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) return canvas.convertToBlob({ type, quality })
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas encoding failed'))),
      type,
      quality,
    )
  })
}

async function render(
  bitmap: ImageBitmap,
  maxEdge: number,
  mime: string,
  quality: number,
): Promise<Blob> {
  const [width, height] = scaledSize(bitmap.width, bitmap.height, maxEdge)
  const canvas = canvasFor(width, height)
  const context = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null
  if (!context) throw new Error('2D canvas is unavailable')
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, 0, 0, width, height)
  return toBlob(canvas, mime, quality)
}

/** True when the browser can actually produce WebP (Safari < 14 could not). */
let webpSupport: boolean | null = null

async function supportsWebp(): Promise<boolean> {
  if (webpSupport !== null) return webpSupport
  try {
    const probe = canvasFor(1, 1)
    const blob = await toBlob(probe, 'image/webp', 0.5)
    webpSupport = blob.type === 'image/webp'
  } catch {
    webpSupport = false
  }
  return webpSupport
}

export async function encodeImage(source: Blob): Promise<EncodedImage> {
  // Vector and animated formats are stored verbatim; rasterising them would
  // lose either resolution or the animation.
  if (PASSTHROUGH.has(source.type)) {
    const size = await intrinsicSize(source)
    return { blob: source, thumb: source, ...size, mime: source.type }
  }

  const bitmap = await createImageBitmap(source)
  try {
    const mime = (await supportsWebp()) ? 'image/webp' : 'image/jpeg'
    const [width, height] = scaledSize(bitmap.width, bitmap.height, MAX_EDGE)
    const [blob, thumb] = await Promise.all([
      render(bitmap, MAX_EDGE, mime, QUALITY),
      render(bitmap, THUMB_EDGE, mime, THUMB_QUALITY),
    ])

    // Re-encoding can make an already-optimised image bigger. When it does,
    // keep the original and use the thumbnail only for previews.
    if (blob.size >= source.size && source.type.startsWith('image/')) {
      return { blob: source, thumb, width, height, mime: source.type }
    }
    return { blob, thumb, width, height, mime }
  } finally {
    bitmap.close()
  }
}

/** Reads an image's natural dimensions without decoding it into a canvas. */
export async function intrinsicSize(blob: Blob): Promise<{ width: number; height: number }> {
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Could not read image dimensions'))
      image.src = url
    })
    return { width: image.naturalWidth, height: image.naturalHeight }
  } catch {
    return { width: 0, height: 0 }
  } finally {
    URL.revokeObjectURL(url)
  }
}
