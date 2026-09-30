import { useFreshDb } from './helpers/fresh-db'
import { beforeEach, describe, expect, it } from 'vitest'
import { purgeOrphanAssets, referencedAssetIds } from '$lib/db/repo/assets'
import * as notesRepo from '$lib/db/repo/notes'

const ID_A = '11111111-1111-4111-8111-111111111111'
const ID_B = '22222222-2222-4222-8222-222222222222'

function fakeAsset(id: string) {
  return {
    id,
    hash: id,
    blob: new Blob(['x']),
    thumb: new Blob(['x']),
    mime: 'image/webp',
    width: 1,
    height: 1,
    bytes: 1,
    origin: 'paste' as const,
    sourceUrl: null,
    createdAt: Date.now(),
  }
}

describe('referencedAssetIds', () => {
  it('finds every image reference in a body', () => {
    expect(referencedAssetIds(`![[img:${ID_A}]] text ![[img:${ID_B}]]`)).toEqual([ID_A, ID_B])
  })

  it('ignores malformed references', () => {
    expect(referencedAssetIds('![[img:not-a-uuid]] ![[note]]')).toEqual([])
  })
})

describe('purgeOrphanAssets', () => {
  beforeEach(async () => {
    await useFreshDb('noter-assets')
  })

  it('deletes assets no note references', async () => {
    const db = await import('$lib/db/db').then((m) => m.db)
    await db.assets.bulkAdd([fakeAsset(ID_A), fakeAsset(ID_B)])
    await notesRepo.createNote({ body: `![[img:${ID_A}]]` })

    expect(await purgeOrphanAssets()).toBe(1)
    expect(await db.assets.get(ID_A)).toBeDefined()
    expect(await db.assets.get(ID_B)).toBeUndefined()
  })

  it('treats trashed notes as still holding their images', async () => {
    const db = await import('$lib/db/db').then((m) => m.db)
    await db.assets.add(fakeAsset(ID_A))
    const note = await notesRepo.createNote({ body: `![[img:${ID_A}]]` })
    await notesRepo.trashNote(note.id)

    expect(await purgeOrphanAssets()).toBe(0)

    // Only emptying the trash actually releases the image.
    await notesRepo.deleteNoteForever(note.id)
    expect(await purgeOrphanAssets()).toBe(1)
  })
})
