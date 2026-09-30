import { liveQuery, type Subscription } from 'dexie'
import { db } from '$lib/db/db'
import type { RunningTimer, Sound, SoundRecipe, TimerPreset } from '$lib/db/schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast, orderBetween } from '$lib/utils/order'
import { alarm, BUILTIN_SOUNDS, DEFAULT_SOUND_ID } from '$lib/audio/beeps'
import { reminders } from '$lib/reminders/engine'
import { alerts } from '$lib/stores/alerts.svelte'
import { theme } from '$lib/stores/theme.svelte'
import * as notify from '$lib/platform/notify'
import { formatLength } from './duration'
import { t } from '$lib/i18n/index.svelte'

/** One, three, five… the timers people reach for most, created on first run. */
const DEFAULT_PRESETS: [number, string][] = [
  [60, 'timers.defaults.quick'],
  [180, 'timers.defaults.tea'],
  [300, 'timers.defaults.break'],
  [600, 'timers.defaults.oven'],
  [900, 'timers.defaults.focus'],
  [1800, 'timers.defaults.nap'],
  [3600, 'timers.defaults.hour'],
]

/**
 * Timers: presets you start with one tap, the timers counting down, and the
 * custom alarm sounds. Everything lives in IndexedDB with absolute end times,
 * so a reload, a second tab or a sleeping laptop never loses a timer.
 */
class TimersStore {
  presets = $state<TimerPreset[]>([])
  running = $state<RunningTimer[]>([])
  sounds = $state<Sound[]>([])
  loaded = $state(false)

  #subs: Subscription[] = []
  #started = false

  ringing: RunningTimer[] = $derived(this.running.filter((timer) => timer.firedAt > 0))

  start(): void {
    if (this.#started) return
    this.#started = true
    this.#subs.push(
      liveQuery(() => db.timerPresets.orderBy('order').toArray()).subscribe((presets) => {
        this.presets = presets
        this.loaded = true
      }),
      liveQuery(() => db.timers.toArray()).subscribe((timers) => {
        this.running = timers.sort((a, b) => a.createdAt - b.createdAt)
        this.#syncSound()
        reminders.poke()
      }),
      liveQuery(() => db.sounds.toArray()).subscribe((sounds) => {
        this.sounds = sounds
      }),
    )
    void this.#seed()

    reminders.register('timers', () =>
      this.running
        .filter((timer) => timer.endAt > 0 && timer.firedAt === 0)
        .map((timer) => ({ key: timer.id, at: timer.endAt, fire: () => this.#fire(timer.id) })),
    )
    alerts.register('timers', () =>
      this.ringing.map((timer) => ({
        id: `timer-${timer.id}`,
        section: 'timers' as const,
        tone: 'danger' as const,
        icon: 'alarm-clock',
        title: t('timers.ringingTitle', { label: timer.label || t('timers.timer') }),
        action: { label: t('timers.stop'), run: () => void this.dismiss(timer.id) },
      })),
    )
  }

  async #seed(): Promise<void> {
    // Settings load asynchronously; wait until they have, or a returning user
    // who deleted every preset would get the defaults back.
    await theme.ready
    if (theme.settings.timers.seeded) return
    if ((await db.timerPresets.count()) === 0) {
      const now = Date.now()
      await db.timerPresets.bulkAdd(
        DEFAULT_PRESETS.map(([seconds, label], index) => ({
          id: uuid(),
          label: t(label),
          seconds,
          soundId: DEFAULT_SOUND_ID,
          color: null,
          repeat: 0 as const,
          order: index + 1,
          createdAt: now,
          updatedAt: now,
        })),
      )
    }
    theme.update({ timers: { ...theme.settings.timers, seeded: true } })
  }

  recipe(soundId: string): SoundRecipe {
    return (
      BUILTIN_SOUNDS.find((s) => s.id === soundId)?.recipe ??
      this.sounds.find((s) => s.id === soundId)?.recipe ??
      BUILTIN_SOUNDS[0]!.recipe
    )
  }

  soundName(soundId: string): string {
    const builtin = BUILTIN_SOUNDS.find((s) => s.id === soundId)
    if (builtin) return t(builtin.label)
    return this.sounds.find((s) => s.id === soundId)?.name ?? t(BUILTIN_SOUNDS[0]!.label)
  }

  // --- Running timers -------------------------------------------------------

  async startTimer(input: {
    seconds: number
    label?: string
    soundId?: string
    presetId?: string | null
    repeat?: boolean
  }): Promise<RunningTimer> {
    // Starting is the user gesture that allows the alarm to make sound later.
    alarm.unlock()
    const now = Date.now()
    const timer: RunningTimer = {
      id: uuid(),
      presetId: input.presetId ?? null,
      label: input.label ?? '',
      seconds: input.seconds,
      endAt: now + input.seconds * 1000,
      pausedRemaining: null,
      soundId: input.soundId ?? theme.settings.timers.defaultSoundId,
      repeat: input.repeat ? 1 : 0,
      firedAt: 0,
      createdAt: now,
    }
    await db.timers.add(timer)
    void this.#scheduleNative(timer)
    return timer
  }

  async startPreset(preset: TimerPreset): Promise<void> {
    await this.startTimer({
      seconds: preset.seconds,
      label: preset.label,
      soundId: preset.soundId,
      presetId: preset.id,
      repeat: preset.repeat === 1,
    })
  }

  async pause(id: string): Promise<void> {
    const timer = await db.timers.get(id)
    if (!timer || timer.endAt === 0 || timer.firedAt) return
    await db.timers.update(id, { pausedRemaining: Math.max(0, timer.endAt - Date.now()), endAt: 0 })
    void notify.cancel(id)
  }

  async resume(id: string): Promise<void> {
    alarm.unlock()
    const timer = await db.timers.get(id)
    if (!timer || timer.pausedRemaining === null) return
    const endAt = Date.now() + timer.pausedRemaining
    await db.timers.update(id, { endAt, pausedRemaining: null })
    void this.#scheduleNative({ ...timer, endAt })
  }

  async addTime(id: string, seconds: number): Promise<void> {
    const timer = await db.timers.get(id)
    if (!timer) return
    if (timer.pausedRemaining !== null) {
      await db.timers.update(id, { pausedRemaining: timer.pausedRemaining + seconds * 1000 })
      return
    }
    // Adding time to a ringing timer turns it back into a countdown: a snooze.
    const base = timer.firedAt ? Date.now() : timer.endAt
    const endAt = base + seconds * 1000
    await db.timers.update(id, {
      endAt,
      firedAt: 0,
      seconds: timer.firedAt ? seconds : timer.seconds + seconds,
    })
    alarm.stop(id)
    void this.#scheduleNative({ ...timer, endAt })
  }

  async restart(id: string): Promise<void> {
    alarm.unlock()
    const timer = await db.timers.get(id)
    if (!timer) return
    const endAt = Date.now() + timer.seconds * 1000
    await db.timers.update(id, { endAt, pausedRemaining: null, firedAt: 0 })
    alarm.stop(id)
    void this.#scheduleNative({ ...timer, endAt })
  }

  async cancel(id: string): Promise<void> {
    alarm.stop(id)
    await db.timers.delete(id)
    void notify.cancel(id)
  }

  /** Stops a ringing timer: a repeating one starts over, anything else is done. */
  async dismiss(id: string): Promise<void> {
    const timer = await db.timers.get(id)
    alarm.stop(id)
    if (timer?.repeat) await this.restart(id)
    else await this.cancel(id)
  }

  async snooze(id: string, minutes: number): Promise<void> {
    await this.addTime(id, minutes * 60)
  }

  async #fire(id: string): Promise<void> {
    const now = Date.now()
    const claimed = await db.transaction('rw', db.timers, async () => {
      const timer = await db.timers.get(id)
      if (!timer || timer.firedAt || !timer.endAt || timer.endAt > now) return null
      await db.timers.update(id, { firedAt: now })
      return timer
    })
    if (!claimed) return
    const settings = theme.settings.timers
    alarm.ring(id, this.recipe(claimed.soundId), settings.volume, settings.ringSeconds * 1000)
    if (theme.settings.notifications) {
      void notify.notify({
        id,
        title: t('timers.ringingTitle', { label: claimed.label || t('timers.timer') }),
        body: t('timers.ringingBody', { length: formatLength(claimed.seconds) }),
      })
    }
  }

  /** Stops the sound of timers that stopped ringing in another tab. */
  #syncSound(): void {
    const ringing = new Set(this.ringing.map((t) => t.id))
    for (const timer of this.running) if (!ringing.has(timer.id)) alarm.stop(timer.id)
  }

  async #scheduleNative(timer: RunningTimer): Promise<void> {
    if (!theme.settings.notifications || !notify.canSchedule()) return
    await notify.schedule({
      id: timer.id,
      at: timer.endAt,
      title: t('timers.ringingTitle', { label: timer.label || t('timers.timer') }),
      body: t('timers.ringingBody', { length: formatLength(timer.seconds) }),
    })
  }

  // --- Presets --------------------------------------------------------------

  async savePreset(input: Omit<TimerPreset, 'id' | 'order' | 'createdAt' | 'updatedAt'> & { id?: string }) {
    const now = Date.now()
    if (input.id) {
      const { id, ...patch } = input
      await db.timerPresets.update(id, { ...patch, updatedAt: now })
      return
    }
    await db.timerPresets.add({
      ...input,
      id: uuid(),
      order: orderAfterLast(this.presets),
      createdAt: now,
      updatedAt: now,
    })
  }

  async duplicatePreset(id: string): Promise<void> {
    const preset = this.presets.find((p) => p.id === id)
    if (!preset) return
    const { id: _id, order: _order, createdAt: _c, updatedAt: _u, ...rest } = preset
    await this.savePreset({ ...rest, label: `${preset.label} ${t('timers.copySuffix')}` })
  }

  async deletePreset(id: string): Promise<void> {
    await db.timerPresets.delete(id)
  }

  /** Moves a preset to sit between two others (null = an end). */
  async movePreset(id: string, before: string | null, after: string | null): Promise<void> {
    const orderOf = (key: string | null) =>
      key ? (this.presets.find((p) => p.id === key)?.order ?? null) : null
    await db.timerPresets.update(id, {
      order: orderBetween(orderOf(before), orderOf(after)),
      updatedAt: Date.now(),
    })
  }

  /** Keyboard reordering: one slot up (-1) or down (+1). */
  async nudgePreset(id: string, direction: -1 | 1): Promise<void> {
    const index = this.presets.findIndex((p) => p.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= this.presets.length) return
    const ids = this.presets.map((p) => p.id)
    ids.splice(index, 1)
    ids.splice(target, 0, id)
    const position = ids.indexOf(id)
    await this.movePreset(id, ids[position - 1] ?? null, ids[position + 1] ?? null)
  }

  // --- Custom sounds ----------------------------------------------------------

  async saveSound(input: { id?: string; name: string; recipe: SoundRecipe }): Promise<string> {
    const now = Date.now()
    if (input.id) {
      await db.sounds.update(input.id, { name: input.name, recipe: input.recipe, updatedAt: now })
      return input.id
    }
    const id = uuid()
    await db.sounds.add({ id, name: input.name, recipe: input.recipe, createdAt: now, updatedAt: now })
    return id
  }

  async deleteSound(id: string): Promise<void> {
    await db.sounds.delete(id)
  }
}

export const timers = new TimersStore()
