/**
 * The one scheduler for everything that rings: timers now, medication doses
 * next. Features register a source — a function returning what is due and
 * when — and poke the engine whenever their data changes.
 *
 * A single timeout to the earliest item, capped at a minute so a sleeping
 * laptop or a throttled background tab catches up soon after it wakes, plus a
 * re-check whenever the page becomes visible again. Browsers cap timeouts at
 * 2^31 ms (about 25 days); longer delays would fire immediately, hence the cap.
 */
export interface DueItem {
  key: string
  /** Timestamp when it is due. */
  at: number
  /**
   * Fires it. Implementations claim the item in a transaction first, so with
   * several tabs open exactly one of them rings.
   */
  fire: () => Promise<void>
}

type Source = () => DueItem[]

const MAX_WAIT = 60_000

class ReminderEngine {
  #sources = new Map<string, Source>()
  #timer: ReturnType<typeof setTimeout> | undefined
  #running = false
  #started = false

  register(name: string, source: Source): () => void {
    this.#sources.set(name, source)
    this.start()
    this.poke()
    return () => {
      this.#sources.delete(name)
      this.poke()
    }
  }

  /** Call after anything that may have changed what is due. */
  poke(): void {
    clearTimeout(this.#timer)
    const items = [...this.#sources.values()].flatMap((source) => source())
    if (items.length === 0) return
    const next = Math.min(...items.map((item) => item.at))
    const wait = Math.max(0, Math.min(MAX_WAIT, next - Date.now()))
    this.#timer = setTimeout(() => void this.#tick(), wait)
  }

  async #tick(): Promise<void> {
    if (this.#running) return
    this.#running = true
    try {
      const now = Date.now()
      const due = [...this.#sources.values()].flatMap((source) => source()).filter((item) => item.at <= now)
      for (const item of due) await item.fire()
    } finally {
      this.#running = false
      this.poke()
    }
  }

  start(): void {
    if (this.#started || typeof document === 'undefined') return
    this.#started = true
    const check = () => {
      if (document.visibilityState === 'visible') void this.#tick()
    }
    document.addEventListener('visibilitychange', check)
    addEventListener('focus', check)
    addEventListener('pageshow', check)
  }
}

export const reminders = new ReminderEngine()
