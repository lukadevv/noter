import { beforeEach, describe, expect, it } from 'vitest'
import { useFreshDb } from './helpers/fresh-db'
import { activitySince, bumpActivity } from '$lib/db/repo/activity'

describe('activity counters', () => {
  beforeEach(async () => {
    await useFreshDb('activity')
  })

  it('adds to a day and reads it back in order', async () => {
    await bumpActivity({ edits: 2, words: 10 }, '2026-09-30')
    await bumpActivity({ edits: 1, created: 1 }, '2026-09-30')
    await bumpActivity({ edits: 1 }, '2026-09-01')
    const rows = await activitySince('2026-09-01')
    expect(rows.map((r) => [r.day, r.edits, r.created, r.words])).toEqual([
      ['2026-09-01', 1, 0, 0],
      ['2026-09-30', 3, 1, 10],
    ])
    expect(await activitySince('2026-09-15')).toHaveLength(1)
  })
})
