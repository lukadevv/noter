import { liveQuery, type Subscription } from 'dexie'
import { db } from '$lib/db/db'
import type { Stopwatch } from '$lib/db/schema'
import { elapsed, EMPTY_STOPWATCH } from './stopwatch'

/**
 * The stopwatch, stored as a start time plus what came before, like the
 * timers: a reload, another tab or a sleeping laptop keeps it counting.
 */
class StopwatchStore {
  watch = $state<Stopwatch>(EMPTY_STOPWATCH)
  #sub: Subscription | null = null

  running: boolean = $derived(this.watch.startedAt > 0)

  start(): void {
    if (this.#sub) return
    this.#sub = liveQuery(() => db.stopwatch.get('main')).subscribe((row) => {
      this.watch = row ?? EMPTY_STOPWATCH
    })
  }

  async #save(patch: Partial<Stopwatch>): Promise<void> {
    const next = { ...this.watch, ...patch, id: 'main', updatedAt: Date.now() }
    // Written through immediately so the UI does not wait on the live query.
    this.watch = next
    await db.stopwatch.put(next)
  }

  async play(): Promise<void> {
    if (this.running) return
    await this.#save({ startedAt: Date.now() })
  }

  async pause(): Promise<void> {
    if (!this.running) return
    await this.#save({ accumulated: elapsed(this.watch, Date.now()), startedAt: 0 })
  }

  async lap(): Promise<void> {
    if (!this.running) return
    await this.#save({ laps: [...this.watch.laps, elapsed(this.watch, Date.now())] })
  }

  async reset(): Promise<void> {
    await this.#save({ startedAt: 0, accumulated: 0, laps: [] })
  }
}

export const stopwatch = new StopwatchStore()
