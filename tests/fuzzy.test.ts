import { describe, expect, it } from 'vitest'
import { fuzzyScore } from '$lib/utils/fuzzy'

describe('fuzzyScore', () => {
  it('matches a subsequence', () => {
    expect(fuzzyScore('nn', 'New note')).not.toBeNull()
    expect(fuzzyScore('nwnt', 'New note')).not.toBeNull()
  })

  it('rejects characters that are out of order', () => {
    expect(fuzzyScore('nn', 'note')).toBeNull()
    expect(fuzzyScore('zzz', 'New note')).toBeNull()
  })

  it('scores an exact prefix above a scattered match', () => {
    const prefix = fuzzyScore('new', 'New note')!
    const scattered = fuzzyScore('new', 'Rename the view')!
    expect(prefix).toBeGreaterThan(scattered)
  })

  it('rewards word starts', () => {
    expect(fuzzyScore('nn', 'New note')!).toBeGreaterThan(fuzzyScore('nn', 'Announcement')!)
  })

  it('treats an empty needle as a match', () => {
    expect(fuzzyScore('', 'anything')).toBe(0)
  })
})
