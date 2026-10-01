import { liveQuery, type Subscription } from 'dexie'
import { db } from '$lib/db/db'
import type { Dose, Med } from '$lib/db/schema'
import { uuid } from '$lib/utils/uuid'
import { orderAfterLast } from '$lib/utils/order'
import { reminders } from '$lib/reminders/engine'
import { alerts, type Alert } from '$lib/stores/alerts.svelte'
import { theme } from '$lib/stores/theme.svelte'
import { alarm, BUILTIN_SOUNDS } from '$lib/audio/beeps'
import * as notify from '$lib/platform/notify'
import { confirm } from '$lib/stores/confirm.svelte'
import { ui } from '$lib/stores/ui.svelte'
import { doseCheck, dosesLeft, formatSpan, lowStock, statusOf, DAY, type MedStatus } from './schedule'
import { t } from '$lib/i18n/index.svelte'

/** How far back dose history is kept in memory (the database keeps everything). */
const HISTORY_DAYS = 45

export type MedInput = Pick<
  Med,
  'name' | 'dose' | 'color' | 'intervalHours' | 'leadMinutes' | 'notes' | 'stock' | 'perDose'
>

/**
 * Medication: what you take, how often, and a log of each dose.
 *
 * Pressing "Taken" logs a dose and moves the next one to one interval from
 * now. A reminder fires when the next dose is due (and, on Android, is handed
 * to the system so it arrives with the app closed); the dashboard and the
 * alerts show what is coming up.
 */
class MedsStore {
  meds = $state<Med[]>([])
  doses = $state<Dose[]>([])
  loaded = $state(false)
  /** Ticks every 30 s so "due in…" and the alerts stay current. */
  now = $state(Date.now())

  #subs: Subscription[] = []
  #started = false

  active: Med[] = $derived(this.meds.filter((m) => m.active === 1))

  statuses: Map<string, MedStatus> = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt whole on every change
    const map = new Map<string, MedStatus>()
    for (const med of this.meds) map.set(med.id, statusOf(med, this.doses, this.now))
    return map
  })

  start(): void {
    if (this.#started) return
    this.#started = true
    this.#subs.push(
      liveQuery(() => db.meds.orderBy('order').toArray()).subscribe((meds) => {
        this.meds = meds
        this.loaded = true
        reminders.poke()
      }),
      liveQuery(() =>
        db.doses
          .where('takenAt')
          .above(Date.now() - HISTORY_DAYS * DAY)
          .toArray(),
      ).subscribe((doses) => {
        this.doses = doses.sort((a, b) => a.takenAt - b.takenAt)
        reminders.poke()
      }),
    )
    setInterval(() => (this.now = Date.now()), 30_000)
    document.addEventListener('visibilitychange', () => (this.now = Date.now()))

    reminders.register('meds', () =>
      this.active.flatMap((med) => {
        const status = this.statuses.get(med.id)
        if (!status?.nextDue || med.notifiedDue >= status.nextDue) return []
        return [
          { key: `med-${med.id}`, at: status.nextDue, fire: () => this.#remind(med.id, status.nextDue!) },
        ]
      }),
    )
    alerts.register('meds', () => this.#alerts())
  }

  #alerts(): Alert[] {
    const list: Alert[] = []
    for (const med of this.active) {
      const status = this.statuses.get(med.id)
      if (!status) continue
      const take = { label: t('meds.taken'), run: () => void this.requestTake(med.id) }
      const title = `${med.name}${med.dose ? ` · ${med.dose}` : ''}`
      if (status.state === 'soon') {
        list.push({
          id: `med-soon-${med.id}`,
          section: 'meds',
          tone: 'info',
          icon: 'pill',
          title: t('meds.alerts.soon', { name: title, span: formatSpan(status.remaining) }),
          action: take,
        })
      } else if (status.state === 'due') {
        list.push({
          id: `med-due-${med.id}`,
          section: 'meds',
          tone: 'warn',
          icon: 'pill',
          title: t('meds.alerts.due', { name: title }),
          action: take,
        })
      } else if (status.state === 'overdue') {
        list.push({
          id: `med-late-${med.id}`,
          section: 'meds',
          tone: 'danger',
          icon: 'pill',
          title: t('meds.alerts.overdue', { name: title, span: formatSpan(status.remaining) }),
          action: take,
        })
      }
      if (lowStock(med)) {
        list.push({
          id: `med-stock-${med.id}`,
          section: 'meds',
          tone: 'warn',
          icon: 'package',
          title: t('meds.alerts.lowStock', { name: med.name, count: dosesLeft(med) ?? 0 }),
        })
      }
    }
    return list
  }

  async #remind(id: string, due: number): Promise<void> {
    const claimed = await db.transaction('rw', db.meds, async () => {
      const med = await db.meds.get(id)
      if (!med || !med.active || med.notifiedDue >= due) return null
      await db.meds.update(id, { notifiedDue: due })
      return med
    })
    if (!claimed) return
    // A short chime rather than a ringing alarm: a dose is a nudge, not an oven.
    alarm.preview(BUILTIN_SOUNDS.find((s) => s.id === 'soft')!.recipe, theme.settings.timers.volume)
    if (theme.settings.notifications) {
      void notify.notify({
        id: `med-${id}`,
        title: t('meds.alerts.due', { name: claimed.name }),
        body: claimed.dose ? t('meds.notifyBody', { dose: claimed.dose }) : t('meds.notifyBodyPlain'),
      })
    }
  }

  /** Hands the next dose to the OS on Android, so it reminds with the app closed. */
  async #scheduleNative(med: Med, nextDue: number): Promise<void> {
    if (!theme.settings.notifications || !notify.canSchedule()) return
    await notify.cancel(`med-${med.id}`)
    await notify.schedule({
      id: `med-${med.id}`,
      at: nextDue,
      title: t('meds.alerts.due', { name: med.name }),
      body: med.dose ? t('meds.notifyBody', { dose: med.dose }) : t('meds.notifyBodyPlain'),
    })
  }

  // --- Doses ----------------------------------------------------------------

  /**
   * The "Taken" button. Logs the dose - unless it comes well before the next
   * one is due, in which case it says so and asks first: a second tap, a
   * double dose or the wrong row are all easy to do and worth a pause. Then
   * a toast offers to undo. Resolves to whether a dose was logged.
   */
  async requestTake(medId: string, at = Date.now()): Promise<boolean> {
    const med = this.meds.find((m) => m.id === medId)
    if (!med) return false
    const warning = doseCheck(med, this.doses, at)
    if (warning) {
      const time = (ms: number) =>
        new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const details = [
        t('meds.confirm.schedule', { hours: med.intervalHours, count: warning.perDay }),
        t('meds.confirm.recent', { count: warning.recent, hours: med.intervalHours }),
        t('meds.confirm.next', { time: time(warning.nextDue), span: formatSpan(warning.early) }),
      ]
      if (warning.today >= warning.perDay) {
        details.push(t('meds.confirm.today', { count: warning.today, max: warning.perDay }))
      }
      const ok = await confirm.ask({
        title: t('meds.confirm.title', { name: med.name }),
        body: t('meds.confirm.body'),
        details,
        confirmLabel: t('meds.confirm.anyway'),
        cancelLabel: t('meds.confirm.cancel'),
        tone: 'warn',
        icon: 'pill',
      })
      if (!ok) return false
    }
    const dose = await this.take(medId, at)
    ui.toast(t('meds.logged', { name: med.name }), 'ok', {
      label: t('meds.undo'),
      run: () => void this.undo(dose.id),
    })
    return true
  }

  /** Logs a dose (now, or at a time the user picks) and reschedules the next. */
  async take(medId: string, at = Date.now(), status: Dose['status'] = 'taken'): Promise<Dose> {
    const now = Date.now()
    const dose: Dose = { id: uuid(), medId, takenAt: at, status, createdAt: now, updatedAt: now }
    await db.transaction('rw', db.doses, db.meds, async () => {
      await db.doses.add(dose)
      const med = await db.meds.get(medId)
      if (med && status === 'taken' && med.stock !== null) {
        await db.meds.update(medId, { stock: Math.max(0, med.stock - med.perDose), updatedAt: now })
      }
    })
    const med = this.meds.find((m) => m.id === medId)
    if (med) void this.#scheduleNative(med, at + med.intervalHours * 3_600_000)
    this.now = Date.now()
    return dose
  }

  async skip(medId: string): Promise<void> {
    await this.take(medId, Date.now(), 'skipped')
  }

  /** Removes a logged dose (a mis-tap), putting its stock back. */
  async undo(doseId: string): Promise<void> {
    await db.transaction('rw', db.doses, db.meds, async () => {
      const dose = await db.doses.get(doseId)
      if (!dose) return
      await db.doses.delete(doseId)
      const med = await db.meds.get(dose.medId)
      if (med && dose.status === 'taken' && med.stock !== null) {
        await db.meds.update(med.id, { stock: med.stock + med.perDose, updatedAt: Date.now() })
      }
    })
    this.now = Date.now()
  }

  // --- Medications ------------------------------------------------------------

  async save(input: MedInput & { id?: string }): Promise<void> {
    const now = Date.now()
    if (input.id) {
      const { id, ...patch } = input
      await db.meds.update(id, { ...patch, updatedAt: now })
      return
    }
    await db.meds.add({
      ...input,
      id: uuid(),
      active: 1,
      notifiedDue: 0,
      order: orderAfterLast(this.meds),
      createdAt: now,
      updatedAt: now,
    })
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await db.meds.update(id, { active: active ? 1 : 0, updatedAt: Date.now() })
    if (!active) void notify.cancel(`med-${id}`)
  }

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.meds, db.doses, async () => {
      await db.doses.where('medId').equals(id).delete()
      await db.meds.delete(id)
    })
    void notify.cancel(`med-${id}`)
  }
}

export const meds = new MedsStore()
