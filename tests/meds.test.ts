import { describe, expect, it } from 'vitest'
import type { Dose, Med } from '$lib/db/schema'
import {
  adherence,
  dosesLeft,
  formatSpan,
  history,
  lowStock,
  statusOf,
  startOfDay,
} from '$lib/meds/schedule'

const HOUR = 3_600_000
const NOW = new Date(2026, 8, 30, 12, 0).getTime()

function med(extra: Partial<Med> = {}): Med {
  return {
    id: 'm',
    name: 'Pill',
    dose: '1 tablet',
    color: null,
    intervalHours: 12,
    leadMinutes: 60,
    notes: '',
    stock: null,
    perDose: 1,
    active: 1,
    notifiedDue: 0,
    order: 1,
    createdAt: NOW - 30 * 24 * HOUR,
    updatedAt: NOW,
    ...extra,
  }
}

function dose(hoursAgo: number, status: Dose['status'] = 'taken'): Dose {
  const at = NOW - hoursAgo * HOUR
  return { id: `d${hoursAgo}`, medId: 'm', takenAt: at, status, createdAt: at, updatedAt: at }
}

describe('dose schedule', () => {
  it('asks for the first dose when none is logged', () => {
    expect(statusOf(med(), [], NOW)).toMatchObject({ state: 'first', nextDue: null })
  })

  it('counts the interval from the last dose actually taken', () => {
    const status = statusOf(med(), [dose(20), dose(4)], NOW)
    expect(status.nextDue).toBe(NOW + 8 * HOUR)
    expect(status.state).toBe('ok')
    expect(status.progress).toBeCloseTo(4 / 12)
  })

  it('moves through soon, due and overdue', () => {
    expect(statusOf(med(), [dose(11.5)], NOW).state).toBe('soon')
    expect(statusOf(med(), [dose(12.2)], NOW).state).toBe('due')
    expect(statusOf(med(), [dose(15)], NOW).state).toBe('overdue')
    expect(statusOf(med({ active: 0 }), [dose(15)], NOW).state).toBe('paused')
  })

  it('treats a skipped dose as handled', () => {
    expect(statusOf(med(), [dose(15), dose(1, 'skipped')], NOW).nextDue).toBe(NOW + 11 * HOUR)
  })
})

describe('history and adherence', () => {
  it('compares doses taken each day with the slots that came due', () => {
    // First dose two days ago at 08:00, every 12 h: slots at 08:00 and 20:00.
    const first = startOfDay(NOW) - 2 * 24 * HOUR + 8 * HOUR
    const at = (t: number, id: string): Dose => ({
      id,
      medId: 'm',
      takenAt: t,
      status: 'taken',
      createdAt: t,
      updatedAt: t,
    })
    const doses = [
      at(first, 'a'),
      at(first + 12 * HOUR, 'b'),
      at(first + 24 * HOUR, 'c'),
      at(first + 48 * HOUR, 'd'),
    ]
    const days = history(med(), doses, NOW, 3)
    expect(days.map((d) => [d.taken, d.expected])).toEqual([
      [2, 2],
      [1, 2],
      // Today at noon only the 08:00 slot has come due.
      [1, 1],
    ])
    expect(adherence(days)).toBeCloseTo(4 / 5)
  })

  it('expects nothing before the first dose', () => {
    const days = history(med(), [], NOW, 3)
    expect(days.every((d) => d.expected === 0)).toBe(true)
    expect(adherence(days)).toBeNull()
  })
})

describe('stock', () => {
  it('counts doses left and flags when it runs low', () => {
    expect(dosesLeft(med({ stock: 7, perDose: 2 }))).toBe(3)
    expect(lowStock(med({ stock: 5 }))).toBe(true)
    expect(lowStock(med({ stock: 30 }))).toBe(false)
    expect(lowStock(med())).toBe(false)
  })
})

describe('formatSpan', () => {
  it('formats short and long spans', () => {
    expect(formatSpan(5 * HOUR + 12 * 60_000)).toBe('5 h 12 min')
    expect(formatSpan(-30 * 60_000)).toBe('30 min')
    expect(formatSpan(51 * HOUR)).toBe('2 d 3 h')
    expect(formatSpan(24 * HOUR)).toBe('24 h')
  })
})
