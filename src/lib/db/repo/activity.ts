import { db } from '../db'
import type { ActivityDay } from '../schema'
import { dayKey } from '$lib/utils/dates'

type Counters = Partial<Pick<ActivityDay, 'edits' | 'created' | 'words'>>

/** Adds to today's counters. Failures are swallowed: statistics never block a save. */
export async function bumpActivity(delta: Counters, day: string = dayKey()): Promise<void> {
  try {
    await db.transaction('rw', db.activity, async () => {
      const row = (await db.activity.get(day)) ?? { day, edits: 0, created: 0, words: 0, updatedAt: 0 }
      await db.activity.put({
        day,
        edits: row.edits + (delta.edits ?? 0),
        created: row.created + (delta.created ?? 0),
        words: row.words + (delta.words ?? 0),
        updatedAt: Date.now(),
      })
    })
  } catch (error) {
    console.warn('Could not record activity', error)
  }
}

/** Every recorded day from `day` on, oldest first. */
export async function activitySince(day: string): Promise<ActivityDay[]> {
  return db.activity.where('day').aboveOrEqual(day).sortBy('day')
}

/** Letters and digits in a row count as a word, in any script. */
export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0
}
