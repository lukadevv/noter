import { describe, expect, it } from 'vitest'
import { decodeNote, inlineSharedImages } from '$lib/share/encode'
import { compressToEncodedURIComponent } from 'lz-string'

const ASSET = '11111111-1111-4111-8111-111111111111'

function encode(payload: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

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
