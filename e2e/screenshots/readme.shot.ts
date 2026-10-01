import { expect, test, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { en } from '../../src/lib/i18n/locales/en'
import { LOCALES, type Locale, type MessageTree } from '../../src/lib/i18n/types'
import { APP_READY } from '../helpers'
import { DEMO, type DemoData } from './demo-data'

/**
 * Takes the README screenshots once per language, into docs/screenshots/<locale>/.
 *
 * Each run starts from an empty origin, lets the app create its database, then
 * fills it with demo content from a page that does not run the app (so nothing
 * overwrites the seed), and finally photographs each section. The clock is
 * pinned to a Wednesday evening so greetings, streaks and "due now" read the
 * same every time.
 */

const NOW = Date.UTC(2026, 8, 30, 20, 30) // Wed 30 Sep 2026, 20:30 (timezone is UTC)
const HOUR = 3_600_000
const DAY = 24 * HOUR

const OUT_DIR = fileURLToPath(new URL('../../docs/screenshots/', import.meta.url))

/** Browser locale per app language, for dates and numbers formatted by Intl. */
const BROWSER_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar',
}

const SHOTS: { name: string; path: string; ready: string }[] = [
  { name: 'home', path: '/', ready: 'home' },
  { name: 'meds', path: '/#/meds', ready: 'med-card' },
  { name: 'habits', path: '/#/habits', ready: 'habit-card' },
  { name: 'pomodoro', path: '/#/timers/pomodoro', ready: 'pomodoro' },
]

/** Same keys and order as DEFAULT_PRESETS in src/lib/timers/store.svelte.ts. */
const PRESET_KEYS = ['quick', 'tea', 'break', 'oven', 'focus', 'nap', 'hour']

async function catalogue(locale: Locale): Promise<MessageTree> {
  if (locale === 'en') return en as unknown as MessageTree
  const module = (await import(`../../src/lib/i18n/locales/${locale}.ts`)) as {
    default: MessageTree
  }
  return module.default
}

function message(tree: MessageTree, path: string): string | undefined {
  let current: unknown = tree
  for (const segment of path.split('.')) {
    current = (current as Record<string, unknown> | undefined)?.[segment]
  }
  return typeof current === 'string' ? current : undefined
}

function day(offset: number): string {
  return new Date(NOW + offset * DAY).toISOString().slice(0, 10)
}

function at(offset: number, hours: number, minutes = 0): number {
  const start = Date.UTC(2026, 8, 30) + offset * DAY
  return start + hours * HOUR + minutes * 60_000
}

/** Every row the demo puts in IndexedDB, keyed by object store. */
function demoRows(data: DemoData): Record<string, object[]> {
  const stamp = { createdAt: NOW - 30 * DAY, updatedAt: NOW - 30 * DAY }

  const notes = data.notes.map((body, index) => ({
    id: `demo-note-${index}`,
    title: '',
    folderId: '',
    body,
    view: 'doc',
    tags: [],
    pinned: index === 0 ? 1 : 0,
    pinnedInFolder: 0,
    order: index + 1,
    color: null,
    icon: null,
    status: null,
    lang: null,
    template: 0,
    archivedAt: 0,
    deletedAt: 0,
    encrypted: 0,
    daily: null,
    system: null,
    createdAt: at(-12 + index * 2, 10),
    updatedAt: at(-index, 18 - index),
  }))

  const habit = (id: string, name: string, icon: string, color: string, schedule: object, target = 1) => ({
    id,
    name,
    icon,
    color,
    schedule,
    target,
    reminderTime: null,
    notifiedDay: '',
    archived: 0,
    order: ['water', 'read', 'gym'].indexOf(id) + 1,
    ...stamp,
  })
  const habits = [
    habit('water', data.habits.water, 'droplet', '#4fb3d9', { kind: 'daily' }, 8),
    habit('read', data.habits.read, 'book-open', '#c27ad8', { kind: 'daily' }),
    habit('gym', data.habits.gym, 'dumbbell', '#e58c5a', { kind: 'perWeek', times: 3 }),
  ]
  const check = (habitId: string, offset: number, count = 1) => ({
    id: `${habitId}:${day(offset)}`,
    habitId,
    day: day(offset),
    count,
    ...stamp,
  })
  // Today is a Wednesday: Monday and Tuesday are done, today is in progress,
  // and the gym has four full weeks behind it.
  const gymWeeks = [-7, -14, -21, -28].flatMap((week) => [week - 2, week, week + 2])
  const habitChecks = [
    check('water', -2, 8),
    check('water', -1, 8),
    check('water', 0, 3),
    check('read', -2),
    check('read', -1),
    ...gymWeeks.map((offset) => check('gym', offset)),
    check('gym', -2),
    check('gym', -1),
  ]

  const med = (
    id: string,
    name: string,
    dose: string,
    color: string,
    intervalHours: number,
    order: number,
    stock: number | null,
  ) => ({
    id,
    name,
    dose,
    color,
    intervalHours,
    leadMinutes: 30,
    notes: '',
    stock,
    perDose: 1,
    active: 1,
    notifiedDue: 0,
    order,
    createdAt: NOW - 8 * DAY,
    updatedAt: NOW - 8 * DAY,
  })
  const meds = [
    med('ibuprofen', data.meds.ibuprofen, data.meds.ibuprofenDose, '#e06a5a', 12, 1, 13),
    med('vitamin-d', data.meds.vitaminD, data.meds.vitaminDDose, '#4f8fe0', 24, 2, null),
  ]
  const dose = (medId: string, takenAt: number) => ({
    id: `${medId}:${takenAt}`,
    medId,
    takenAt,
    status: 'taken',
    createdAt: takenAt,
    updatedAt: takenAt,
  })
  const doses = [
    ...[-6, -5, -4, -3, -2, -1].flatMap((offset) => [
      dose('ibuprofen', at(offset, 8, 15)),
      dose('ibuprofen', at(offset, 20, 15)),
    ]),
    dose('ibuprofen', at(0, 8, 15)),
    ...[-6, -5, -4, -3, -2, -1, 0].map((offset) => dose('vitamin-d', at(offset, 1))),
  ]

  const focusSessions = [
    [-5, 2],
    [-4, 3],
    [-2, 4],
    [-1, 2],
    [0, 2],
  ].flatMap(([offset, count]) =>
    Array.from({ length: count! }, (_, index) => ({
      id: `focus:${offset}:${index}`,
      day: day(offset!),
      startedAt: at(offset!, 9 + index),
      minutes: 25,
      createdAt: at(offset!, 9 + index),
      updatedAt: at(offset!, 9 + index),
    })),
  )

  const words = [60, 140, 0, 95, 210, 30, 120, 180, 90, 0, 160, 240, 130, 90]
  const activity = words.map((count, index) => ({
    day: day(index - words.length + 1),
    edits: count ? Math.ceil(count / 40) : 0,
    created: index % 4 === 0 ? 1 : 0,
    words: count,
    updatedAt: NOW,
  }))

  return { notes, habits, habitChecks, meds, doses, focusSessions, activity }
}

/** Reads one object store with plain IndexedDB, so it works on any page of the origin. */
function countRows(page: Page, store: string): Promise<number> {
  return page.evaluate(async (name) => {
    const request = indexedDB.open('noter')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      if (!database.objectStoreNames.contains(name)) return 0
      return await new Promise<number>((resolve) => {
        const count = database.transaction(name).objectStore(name).count()
        count.onsuccess = () => resolve(count.result)
        count.onerror = () => resolve(0)
      })
    } finally {
      database.close()
    }
  }, store)
}

async function seed(page: Page, rows: Record<string, object[]>, presetLabels: string[]) {
  await page.evaluate(
    async ({ rows, presetLabels }) => {
      const request = indexedDB.open('noter')
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      const stores = [...Object.keys(rows), 'timerPresets', 'settings']
      const tx = database.transaction(stores, 'readwrite')

      for (const [store, list] of Object.entries(rows)) {
        for (const row of list) tx.objectStore(store).put(row)
      }

      // The app seeded its default timers before the catalogue may have loaded,
      // so their labels are rewritten in this language.
      const presets = tx.objectStore('timerPresets')
      const all = presets.getAll()
      all.onsuccess = () => {
        const sorted = (all.result as { order: number; label: string }[]).sort((a, b) => a.order - b.order)
        sorted.forEach((preset, index) => {
          const label = presetLabels[index]
          if (label) presets.put({ ...preset, label })
        })
      }

      // Hide the welcome tour invitation: the screenshots show a settled app.
      const settings = tx.objectStore('settings')
      const app = settings.get('app')
      app.onsuccess = () => {
        const current = (app.result as { value?: object } | undefined)?.value ?? {}
        settings.put({ key: 'app', value: { ...current, tourDone: true } })
      }

      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
      })
      database.close()
    },
    { rows, presetLabels },
  )
}

for (const locale of LOCALES) {
  test.describe(locale, () => {
    test.use({ locale: BROWSER_LOCALE[locale] })

    test(`screenshots (${locale})`, async ({ page }) => {
      const messages = await catalogue(locale)
      const presetLabels = PRESET_KEYS.map(
        (key) =>
          message(messages, `timers.defaults.${key}`) ??
          message(en as unknown as MessageTree, `timers.defaults.${key}`)!,
      )

      await page.clock.setFixedTime(NOW)
      await page.addInitScript((value) => localStorage.setItem('noter.locale', value), locale)

      // First visit: the app creates its database, settings and default timers.
      await page.goto('/')
      await page.waitForSelector(APP_READY)
      await expect.poll(() => countRows(page, 'timerPresets'), { timeout: 15_000 }).toBeGreaterThan(0)
      // Give the app a moment to finish its first-run writes before leaving.
      await page.waitForTimeout(500)

      // Seed from a static page of the same origin, with the app closed.
      await page.goto('/privacy.html')
      await seed(page, demoRows(DEMO[locale]), presetLabels)

      const dir = `${OUT_DIR}${locale}/`
      mkdirSync(dir, { recursive: true })

      for (const shot of SHOTS) {
        await page.goto(shot.path)
        await page.waitForSelector(APP_READY)
        await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe(locale)
        await expect(page.getByTestId(shot.ready).first()).toBeVisible()
        await expect(page.getByTestId('tour')).toHaveCount(0)
        // Let lazy chunks, fonts and entrance transitions settle.
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(800)
        await page.screenshot({ path: `${dir}${shot.name}.png`, animations: 'disabled' })
      }
    })
  })
}
