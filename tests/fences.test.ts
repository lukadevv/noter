import { describe, expect, it } from 'vitest'
import { findFences, maskCode, wrapFence } from '$lib/md/fences'
import { extractTags } from '$lib/md/links'
import { derivedTitle, preview } from '$lib/db/repo/notes'

describe('findFences', () => {
  it('finds backtick and tilde fences with their info word', () => {
    const text = 'a\n```js\nx\n```\nb\n~~~board\n## Todo\n~~~\n'
    const fences = findFences(text)
    expect(fences.map((f) => f.info)).toEqual(['js', 'board'])
    expect(fences[0]!.inner).toBe('x')
    expect(text.slice(fences[1]!.innerFrom, fences[1]!.innerTo)).toBe('## Todo')
  })

  it('needs a closing run at least as long as the opener', () => {
    const text = '````md\n```\ninside\n```\n````\nafter'
    const fences = findFences(text)
    expect(fences).toHaveLength(1)
    expect(fences[0]!.inner).toBe('```\ninside\n```')
  })

  it('runs an unclosed fence to the end', () => {
    const [fence] = findFences('```\nopen')
    expect(fence!.closed).toBe(false)
    expect(fence!.inner).toBe('open')
  })

  it('handles an empty fence', () => {
    const [fence] = findFences('```board\n```')
    expect(fence!.inner).toBe('')
  })
})

describe('maskCode', () => {
  it('keeps offsets and hides code, but not board items', () => {
    const text = '#one\n```\n#two\n```\n```board\n- card #three\n```'
    const masked = maskCode(text)
    expect(masked).toHaveLength(text.length)
    expect(extractTags(text)).toEqual(['one', 'three'])
  })
})

describe('wrapFence', () => {
  it('outgrows backtick runs inside', () => {
    expect(wrapFence('md', 'a ``` b')).toBe('````md\na ``` b\n````')
    expect(wrapFence('board', '## A\n')).toBe('```board\n## A\n```')
  })
})

describe('titles and previews around fences', () => {
  it('skips fence lines when deriving a title', () => {
    expect(derivedTitle({ title: '', body: '```board\n## Groceries\n- milk\n```' })).toBe('Groceries')
  })

  it('previews board items but not code', () => {
    expect(preview('```board\n## Todo\n- milk\n```\n```js\nsecret()\n```')).toBe('Todo milk')
  })
})
