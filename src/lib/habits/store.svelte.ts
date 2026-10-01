import { liveQuery, type Subscription } from 'dexie'
import { db } from '$lib/db/db'
import type { Habit, HabitCheck } from '$lib/db/schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast } from '$lib/utils/order'
import { reminders } from '$lib/reminders/engine'
import { alerts } from '$lib/stores/alerts.svelte'
import { theme } from '$lib/stores/theme.svelte'
import { alarm, BUILTIN_SOUNDS } from '$lib/audio/beeps'
import * as notify from '$lib/platform/notify'
import { addDays, dayKey } from '$lib/utils/dates'
import { countsByDay, isDone, isDueToday, reminderAt } from './schedule'
import { t } from '$lib/i18n/index.svelte'
import { uiSound } from '$lib/audio/ui-sounds'

/** How far back checks are kept in memory: enough for the heatmap and streaks. */
const HISTORY_DAYS = 400

export type HabitInput = Pick<Habit, 'name' | 'icon' | 'color' | 'schedule' | 'target' | 'reminderTime'>

/**
 * Habits: things you mean to do every day (or on some days, or so many times
 * a week), checked off with one tap. Each day's progress is one row, so a
 * habit with a target of eight glasses is eight taps on the same row.
 */
class HabitsStore {
  habits = $state<Habit[]>([])
  checks = $state<HabitCheck[]>([])
  loaded = $state(false)
  /** The current day, refreshed so "today" rolls over at midnight. */
  today = $state(dayKey())

  #subs: Subscription[] = []
  #started = false

  active: Habit[] = $derived(this.habits.filter((h) => !h.archived))

  /** Per habit: count by day. */
  counts: Map<string, Map<string, number>> = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt whole on every change
    const map = new Map<string, Map<string, number>>()
    for (const habit of this.habits) map.set(habit.id, countsByDay(this.checks, habit.id))
    return map
  })

  /** Habits still to do today, in order. */
  dueToday: Habit[] = $derived(
    this.active.filter((h) => isDueToday(h, this.counts.get(h.id) ?? new Map(), this.today)),
  )

  start(): void {
    if (this.#started) return
    this.#started = true
    this.#subs.push(
      liveQuery(() => db.habits.orderBy('order').toArray()).subscribe((habits) => {
        this.habits = habits
        this.loaded = true
        reminders.poke()
      }),
      liveQuery(() =>
        db.habitChecks.where('day').aboveOrEqual(addDays(dayKey(), -HISTORY_DAYS)).toArray(),
      ).subscribe((checks) => {
        this.checks = checks
        reminders.poke()
      }),
    )
    setInterval(() => (this.today = dayKey()), 60_000)
    document.addEventListener('visibilitychange', () => (this.today = dayKey()))

    reminders.register('habits', () =>
      this.dueToday.flatMap((habit) => {
        if (!habit.reminderTime || habit.notifiedDay === this.today) return []
        const at = reminderAt(habit.reminderTime, this.today)
        return at ? [{ key: `habit-${habit.id}`, at, fire: () => this.#remind(habit.id) }] : []
      }),
    )
    alerts.register('habits', () => {
      const now = Date.now()
      // Only habits whose reminder time has passed nag on Home; the rest wait.
      return this.dueToday
        .filter((h) => h.reminderTime && (reminderAt(h.reminderTime, this.today) ?? Infinity) <= now)
        .map((habit) => ({
          id: `habit-${habit.id}`,
          section: 'habits' as const,
          tone: 'info' as const,
          icon: habit.icon,
          title: t('habits.alert', { name: habit.name }),
          action: { label: t('habits.done'), run: () => void this.check(habit.id) },
        }))
    })
  }

  async #remind(id: string): Promise<void> {
    const today = this.today
    const claimed = await db.transaction('rw', db.habits, async () => {
      const habit = await db.habits.get(id)
      if (!habit || habit.archived || habit.notifiedDay === today) return null
      await db.habits.update(id, { notifiedDay: today })
      return habit
    })
    if (!claimed) return
    alarm.preview(BUILTIN_SOUNDS.find((s) => s.id === 'soft')!.recipe, theme.settings.timers.volume)
    if (theme.settings.notifications) {
      void notify.notify({
        id: `habit-${id}`,
        title: t('habits.alert', { name: claimed.name }),
        body: t('habits.notifyBody'),
      })
    }
  }

  countOn(habitId: string, day = this.today): number {
    return this.counts.get(habitId)?.get(day) ?? 0
  }

  isDoneOn(habit: Habit, day = this.today): boolean {
    return isDone(habit, this.countOn(habit.id, day))
  }

  // --- Checks ---------------------------------------------------------------

  /** One more (up to the target); a habit with target 1 toggles. Returns whether it is now done. */
  async check(habitId: string, day = this.today): Promise<boolean> {
    const habit = this.habits.find((h) => h.id === habitId)
    if (!habit) return false
    const count = this.countOn(habitId, day)
    const target = Math.max(1, habit.target)
    const next = count >= target ? (target === 1 ? 0 : count) : count + 1
    // Before the write, so it still belongs to the click that asked for it.
    if (next >= target && count < target) uiSound.play('complete')
    await this.#setCount(habitId, day, next)
    return next >= target
  }

  async uncheck(habitId: string, day = this.today): Promise<void> {
    await this.#setCount(habitId, day, Math.max(0, this.countOn(habitId, day) - 1))
  }

  /** Flips a past day between done and not done, from the history grid. */
  async toggleDay(habit: Habit, day: string): Promise<void> {
    await this.#setCount(habit.id, day, this.isDoneOn(habit, day) ? 0 : Math.max(1, habit.target))
  }

  async #setCount(habitId: string, day: string, count: number): Promise<void> {
    const id = `${habitId}:${day}`
    const now = Date.now()
    if (count <= 0) {
      await db.habitChecks.delete(id)
      return
    }
    const existing = await db.habitChecks.get(id)
    await db.habitChecks.put({
      id,
      habitId,
      day,
      count,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    })
  }

  // --- Habits -----------------------------------------------------------------

  async save(input: HabitInput & { id?: string }): Promise<void> {
    const now = Date.now()
    if (input.id) {
      const { id, ...patch } = input
      await db.habits.update(id, { ...patch, updatedAt: now })
      return
    }
    await db.habits.add({
      ...input,
      id: uuid(),
      notifiedDay: '',
      archived: 0,
      order: orderAfterLast(this.habits),
      createdAt: now,
      updatedAt: now,
    })
  }

  async setArchived(id: string, archived: boolean): Promise<void> {
    await db.habits.update(id, { archived: archived ? 1 : 0, updatedAt: Date.now() })
  }

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.habits, db.habitChecks, async () => {
      await db.habitChecks.where('habitId').equals(id).delete()
      await db.habits.delete(id)
    })
  }
}

export const habits = new HabitsStore()
