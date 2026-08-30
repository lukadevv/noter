/**
 * Locale registry.
 *
 * English is bundled because it is the fallback for any key a translation is
 * missing; every other catalogue is fetched on demand, so adding a language
 * costs nothing to people who do not use it.
 */
export const LOCALES = ['en', 'es', 'pt', 'fr', 'de', 'it', 'zh', 'ja', 'ko', 'ar'] as const

export type Locale = (typeof LOCALES)[number]

export interface LocaleInfo {
  /** Written in its own language, which is how a language picker should read. */
  name: string
  /** Text direction. Only Arabic is right-to-left here. */
  dir: 'ltr' | 'rtl'
}

export const LOCALE_INFO: Record<Locale, LocaleInfo> = {
  en: { name: 'English', dir: 'ltr' },
  es: { name: 'Español', dir: 'ltr' },
  pt: { name: 'Português', dir: 'ltr' },
  fr: { name: 'Français', dir: 'ltr' },
  de: { name: 'Deutsch', dir: 'ltr' },
  it: { name: 'Italiano', dir: 'ltr' },
  zh: { name: '中文', dir: 'ltr' },
  ja: { name: '日本語', dir: 'ltr' },
  ko: { name: '한국어', dir: 'ltr' },
  ar: { name: 'العربية', dir: 'rtl' },
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}

/**
 * Picks the best supported locale for a browser's language list.
 *
 * Region subtags are dropped: `pt-BR` and `pt-PT` both map to `pt`, which is
 * more useful than falling back to English over a region we do not distinguish.
 */
export function matchLocale(preferred: readonly string[]): Locale | null {
  for (const tag of preferred) {
    const base = tag.toLowerCase().split('-')[0]
    if (base && isLocale(base)) return base
  }
  return null
}

/**
 * A message is either a string or a set of plural forms.
 *
 * Plural categories come from `Intl.PluralRules`, so Arabic's six forms and
 * Chinese's single form are both handled by the platform rather than by a
 * hand-rolled `n === 1` check.
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>
export type Message = string | PluralForms

export type MessageTree = { [key: string]: Message | MessageTree }
