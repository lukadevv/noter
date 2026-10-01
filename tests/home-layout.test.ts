import { describe, expect, it } from 'vitest'
import { packRows } from '$lib/home/layout'

const SPANS: Record<string, number> = { wide: 12, big: 8, small: 4, half: 6 }
const pack = (ids: string[]) => [...packRows(ids, (id) => SPANS[id.replace(/\d/, '')]!).values()]

describe('home layout', () => {
  it('keeps widgets that fit together on one row', () => {
    expect(pack(['big1', 'small1'])).toEqual([8, 4])
  })

  it('stretches the last widget of a row instead of leaving a hole', () => {
    expect(pack(['big1', 'big2'])).toEqual([12, 12])
    expect(pack(['small1', 'wide1', 'small2'])).toEqual([12, 12, 12])
  })

  it('fills the final row too', () => {
    expect(pack(['wide1', 'half1'])).toEqual([12, 12])
    expect(pack(['small1', 'small2'])).toEqual([4, 8])
  })
})
