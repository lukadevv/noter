import { describe, expect, it } from 'vitest'
import { decodeNote, encodeNote, inlineSharedImages, MAX_URL_LENGTH } from '$lib/share/encode'
import { compressToEncodedURIComponent } from 'lz-string'

const ASSET = '11111111-1111-4111-8111-111111111111'

function encode(payload: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

describe('encodeNote', () => {
  const note = { title: 'A title', body: 'The body text.', view: 'doc' as const }

  it('round-trips through decodeNote', () => {
    const decoded = decodeNote(encodeNote(note).payload)
    expect(decoded).toMatchObject({ t: 'A title', b: 'The body text.', m: 'doc' })
  })

  it('falls back to the derived title when none is set', () => {
    const decoded = decodeNote(encodeNote({ title: '', body: '# Heading\nbody', view: 'doc' }).payload)
    expect(decoded?.t).toBe('Heading')
  })

  it('never carries images, and says how many were left out', () => {
    const withImages = {
      title: 'Pictures',
      body: `one ![[img:${ASSET}]] two ![[img:22222222-2222-4222-8222-222222222222]]`,
      view: 'doc' as const,
    }
    const result = encodeNote(withImages)

    expect(result.imagesOmitted).toBe(2)
    expect(decodeNote(result.payload)?.i).toBeUndefined()
  })

  it('reports nothing omitted for a note with no images', () => {
    expect(encodeNote(note).imagesOmitted).toBe(0)
  })

  it('keeps the image references themselves in the text', () => {
    const body = `see ![[img:${ASSET}]]`
    expect(decodeNote(encodeNote({ title: 'T', body, view: 'doc' }).payload)?.b).toBe(body)
  })

  it('flags a payload too long to share reliably', () => {
    expect(encodeNote(note).tooLong).toBe(false)
    // Random text does not compress, so this reliably exceeds the limit.
    const noise = Array.from({ length: 40_000 }, () => Math.random().toString(36)[2]).join('')
    expect(encodeNote({ title: 'Big', body: noise, view: 'doc' }).tooLong).toBe(true)
    expect(encodeNote({ title: 'Big', body: noise, view: 'doc' }).length).toBeGreaterThan(MAX_URL_LENGTH)
  })
})

describe('decodeNote', () => {
  it('reads a well-formed payload', () => {
    const decoded = decodeNote(encode({ v: 1, t: 'Title', b: '# Body', m: 'doc' }))
    expect(decoded).toEqual({ v: 1, t: 'Title', b: '# Body', m: 'doc', i: undefined })
  })

  it('defaults the view when it is missing', () => {
    expect(decodeNote(encode({ v: 1, t: 'T', b: 'B' }))?.m).toBe('doc')
  })

  // Shared payloads arrive from strangers, so anything malformed must be
  // rejected rather than partially trusted.
  it('rejects a payload with the wrong version', () => {
    expect(decodeNote(encode({ v: 2, t: 'T', b: 'B' }))).toBeNull()
  })

  it('rejects a payload missing its body', () => {
    expect(decodeNote(encode({ v: 1, t: 'T' }))).toBeNull()
  })

  it('rejects a payload whose body is not a string', () => {
    expect(decodeNote(encode({ v: 1, t: 'T', b: { evil: true } }))).toBeNull()
  })

  it('rejects truncated or corrupt input without throwing', () => {
    expect(decodeNote('not-valid-lz-string!!!')).toBeNull()
    expect(decodeNote('')).toBeNull()
  })

  it('drops an images field that is not an object', () => {
    expect(decodeNote(encode({ v: 1, t: 'T', b: 'B', i: 'nope' }))?.i).toBeUndefined()
  })
})

describe('inlineSharedImages', () => {
  it('swaps references for the data URLs carried in the payload', () => {
    const body = `text ![[img:${ASSET}]] more`
    const result = inlineSharedImages(body, { [ASSET]: 'data:image/webp;base64,AAA' })
    expect(result).toContain('![](data:image/webp;base64,AAA)')
  })

  it('leaves references alone when the image was not included', () => {
    const body = `![[img:${ASSET}]]`
    expect(inlineSharedImages(body, {})).toBe(body)
    expect(inlineSharedImages(body, undefined)).toBe(body)
  })
})
