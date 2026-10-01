import { en } from './locales/en'
import {
  LOCALE_INFO,
  isLocale,
  matchLocale,
  type Locale,
  type Message,
  type MessageTree,
  type PluralForms,
} from './types'

export type Messages = typeof en

/**
 * Translation store.
 *
 * English is bundled and every other catalogue is a dynamic import, so the
 * initial payload carries one language rather than ten. Until a catalogue
 * arrives, and for any key a translation happens to miss, lookups fall through
 * to English - a label in the wrong language is bad, a blank one is worse.
 */

/** Values interpolated into `{placeholders}`. `count` also selects a plural form. */
export type Params = Record<string, string | number>

const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<{ default: MessageTree }>> = {
  es: () => import('./locales/es'),
  pt: () => import('./locales/pt'),
  fr: () => import('./locales/fr'),
  de: () => import('./locales/de'),
  it: () => import('./locales/it'),
  zh: () => import('./locales/zh'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  ar: () => import('./locales/ar'),
}

const STORAGE_KEY = 'noter.locale'

function lookup(tree: MessageTree, path: string[]): Message | undefined {
  let current: Message | MessageTree | undefined = tree
  for (const segment of path) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined
    current = (current as MessageTree)[segment]
  }
  return typeof current === 'object' && !isPluralForms(current) ? undefined : (current as Message)
}

function isPluralForms(value: unknown): value is PluralForms {
  return typeof value === 'object' && value !== null && 'other' in value
}

function interpolate(template: string, params: Params | undefined): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  )
}

class I18n {
  locale = $state<Locale>('en')
  /** Bumped when a catalogue finishes loading, to re-run every lookup. */
  #revision = $state(0)
  #catalogues = new Map<Locale, MessageTree>([['en', en as unknown as MessageTree]])
  #pluralRules = new Map<Locale, Intl.PluralRules>()

  dir: 'ltr' | 'rtl' = $derived(LOCALE_INFO[this.locale].dir)

  /**
   * Applies the locale that was in use last time, synchronously.
   *
   * Read from localStorage rather than IndexedDB so the first paint is already
   * in the right language and direction; the catalogue itself then streams in.
   */
  boot(): void {
    const stored = readStored()
    const detected = stored ?? matchLocale(navigator.languages ?? [navigator.language]) ?? 'en'
    this.locale = detected
    applyDocument(detected)
    if (detected !== 'en') void this.#load(detected)
  }

  async setLocale(locale: Locale): Promise<void> {
    await this.#load(locale)
    this.locale = locale
    applyDocument(locale)
    try {
      localStorage.setItem(STORAGE_KEY, locale)
    } catch {
      // Private mode: the choice simply does not persist.
    }
  }

  async #load(locale: Locale): Promise<void> {
    if (locale === 'en' || this.#catalogues.has(locale)) return
    const module = await LOADERS[locale]()
    this.#catalogues.set(locale, module.default)
    this.#revision++
  }

  /** True once the active locale's catalogue is in memory. */
  get ready(): boolean {
    void this.#revision
    return this.#catalogues.has(this.locale)
  }

  #plural(count: number): Intl.LDMLPluralRule {
    let rules = this.#pluralRules.get(this.locale)
    if (!rules) {
      rules = new Intl.PluralRules(this.locale)
      this.#pluralRules.set(this.locale, rules)
    }
    return rules.select(count)
  }

  /**
   * Looks up a dotted key and fills in its placeholders.
   *
   * A `count` parameter selects a plural form through `Intl.PluralRules`, which
   * is why Arabic's six categories and Chinese's single one both work without
   * any special-casing here.
   */
  t = (key: string, params?: Params): string => {
    void this.#revision
    void this.locale

    const path = key.split('.')
    const active = this.#catalogues.get(this.locale)
    const message = (active && lookup(active, path)) ?? lookup(en as unknown as MessageTree, path)

    if (message === undefined) {
      // A missing key is a bug; showing the key makes it obvious in review
      // rather than leaving a mysterious gap in the interface.
      return key
    }

    if (typeof message === 'string') return interpolate(message, params)

    const count = typeof params?.count === 'number' ? params.count : 0
    const category = this.#plural(count)
    const form = message[category] ?? message.other ?? Object.values(message)[0] ?? key
    return interpolate(form, params)
  }
}

function readStored(): Locale | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value && isLocale(value) ? value : null
  } catch {
    return null
  }
}

function applyDocument(locale: Locale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = LOCALE_INFO[locale].dir
}

export const i18n = new I18n()

/** Shorthand so components can write `t('sidebar.search')`. */
export const t = i18n.t

export { LOCALES, LOCALE_INFO, isLocale, matchLocale } from './types'
export type { Locale } from './types'
