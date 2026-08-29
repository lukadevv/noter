import { describe, expect, it } from 'vitest'
import { needsRebalance, orderAfterLast, orderBetween, rebalance, ORDER_STEP } from '$lib/utils/order'

describe('fractional ordering', () => {
  it('places an item between its neighbours', () => {
    expect(orderBetween(100, 200)).toBe(150)
  })

  it('extends past the ends of a list', () => {
    expect(orderBetween(null, 100)).toBeLessThan(100)
    expect(orderBetween(100, null)).toBeGreaterThan(100)
    expect(orderBetween(null, null)).toBe(ORDER_STEP)
  })

  it('keeps the sequence stable across repeated inserts in the same gap', () => {
    let before = 0
    const after = 1000
    const inserted: number[] = []
    for (let i = 0; i < 20; i++) {
      const order = orderBetween(before, after)
      inserted.push(order)
      before = order
    }
    const sorted = [...inserted].sort((a, b) => a - b)
    expect(inserted).toEqual(sorted)
    expect(new Set(inserted).size).toBe(inserted.length)
  })

  it('appends after the largest existing order', () => {
    expect(orderAfterLast([{ order: 10 }, { order: 4000 }, { order: 30 }])).toBe(4000 + ORDER_STEP)
    expect(orderAfterLast([])).toBe(ORDER_STEP)
  })

  it('flags gaps that have run out of float precision', () => {
    expect(needsRebalance(150, 100, 200)).toBe(false)
    expect(needsRebalance(100.0000001, 100, 200)).toBe(true)
  })

  it('respaces a list without reordering it', () => {
    const items = [{ id: 'a', order: 1 }, { id: 'b', order: 1.0000001 }, { id: 'c', order: 2 }]
    const result = rebalance(items)
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(result.map((i) => i.order)).toEqual([1000, 2000, 3000])
  })
})
