import { describe, expect, it } from 'vitest'
import { migrateBodyForView } from '$lib/md/migrate'
import { derivedTitle } from '$lib/db/repo/notes'

const IMG_A = '![[img:11111111-1111-4111-8111-111111111111]]'
const IMG_B = '![[img:22222222-2222-4222-8222-222222222222]]'

describe('migrateBodyForView', () => {
  it('wraps a board note in a board fence, once', () => {
    const body = '## To do\n- milk\n## Done\n- bread'
    const migrated = migrateBodyForView('board', body)
    expect(migrated).toBe('```board\n## To do\n- milk\n## Done\n- bread\n```')
    expect(migrateBodyForView('board', migrated)).toBe(migrated)
  })

  it('keeps the title a board note had', () => {
    const body = '## Groceries\n- milk'
    expect(derivedTitle({ title: '', body: migrateBodyForView('board', body) })).toBe(
      derivedTitle({ title: '', body }),
    )
  })

  it('moves gallery images into a gallery fence and keeps the text', () => {
    const body = `Trip photos\n\n${IMG_A}\n${IMG_B}\n`
    expect(migrateBodyForView('gallery', body)).toBe(
      `Trip photos\n\n\`\`\`gallery\n${IMG_A}\n${IMG_B}\n\`\`\``,
    )
    expect(migrateBodyForView('gallery', '')).toBe('```gallery\n\n```')
  })

  it('fences code notes with their language', () => {
    expect(migrateBodyForView('code', 'print(1)', 'python')).toBe('```python\nprint(1)\n```')
    expect(migrateBodyForView('code', '```\nx\n```', 'rust')).toBe('```rust\nx\n```')
    expect(migrateBodyForView('code', '```js\nx\n```', 'rust')).toBe('```js\nx\n```')
    expect(migrateBodyForView('code', 'a ``` b', null)).toBe('````\na ``` b\n````')
  })

  it('leaves documents and checklists alone', () => {
    expect(migrateBodyForView('doc', '# Hi')).toBe('# Hi')
    expect(migrateBodyForView('checklist', '- [ ] a')).toBe('- [ ] a')
  })
})
