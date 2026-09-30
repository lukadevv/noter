import { describe, expect, it } from 'vitest'
import { en } from '$lib/i18n/locales/en'
import { LOCALES, LOCALE_INFO, isLocale, matchLocale, type Locale } from '$lib/i18n/types'

import es from '$lib/i18n/locales/es'
import pt from '$lib/i18n/locales/pt'
import fr from '$lib/i18n/locales/fr'
import de from '$lib/i18n/locales/de'
// Aliased: a bare `it` would shadow vitest's own `it`.
import italian from '$lib/i18n/locales/it'
import zh from '$lib/i18n/locales/zh'
import ja from '$lib/i18n/locales/ja'
import ko from '$lib/i18n/locales/ko'
import ar from '$lib/i18n/locales/ar'

type Tree = Record<string, unknown>

const CATALOGUES: Record<Exclude<Locale, 'en'>, Tree> = {
  es: es as Tree,
  pt: pt as Tree,
  fr: fr as Tree,
  de: de as Tree,
  it: italian as Tree,
  zh: zh as Tree,
  ja: ja as Tree,
  ko: ko as Tree,
  ar: ar as Tree,
}

const PLURAL_CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])

/** True for a plural-forms object rather than a nested group of messages. */
function isPlural(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).every((key) => PLURAL_CATEGORIES.has(key))
  )
}

/** Every message path in a catalogue, with the leaf it points at. */
function flatten(tree: Tree, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>()
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !isPlural(value)) {
      for (const [nested, leaf] of flatten(value as Tree, path)) out.set(nested, leaf)
    } else {
      out.set(path, value)
    }
  }
  return out
}

/** Placeholder names used by a message, across all its plural forms. */
function placeholders(message: unknown): Set<string> {
  const texts = typeof message === 'string' ? [message] : Object.values(message as Record<string, string>)
  const names = new Set<string>()
  for (const text of texts) {
    for (const match of text.matchAll(/\{(\w+)\}/g)) names.add(match[1]!)
  }
  return names
}

const english = flatten(en as unknown as Tree)

describe('locale registry', () => {
  it('describes every locale it lists', () => {
    for (const locale of LOCALES) {
      expect(LOCALE_INFO[locale]?.name, `${locale} has no name`).toBeTruthy()
      expect(['ltr', 'rtl']).toContain(LOCALE_INFO[locale].dir)
    }
  })

  it('names each language in that language', () => {
    // A picker that lists "Spanish" to a Spanish speaker is a picker they cannot use.
    expect(LOCALE_INFO.es.name).toBe('Español')
    expect(LOCALE_INFO.ja.name).toBe('日本語')
    expect(LOCALE_INFO.ar.name).toBe('العربية')
  })

  it('marks Arabic as right-to-left and nothing else', () => {
    const rtl = LOCALES.filter((locale) => LOCALE_INFO[locale].dir === 'rtl')
    expect(rtl).toEqual(['ar'])
  })

  it('recognises supported tags only', () => {
    expect(isLocale('es')).toBe(true)
    expect(isLocale('xx')).toBe(false)
  })

  it('matches a browser language list, ignoring the region', () => {
    expect(matchLocale(['pt-BR', 'en'])).toBe('pt')
    expect(matchLocale(['zh-Hans-CN'])).toBe('zh')
    expect(matchLocale(['en-GB'])).toBe('en')
  })

  it('returns null when nothing is supported', () => {
    expect(matchLocale(['sw', 'is'])).toBeNull()
  })
})

describe('catalogues', () => {
  it('has a loader for every locale except the bundled one', () => {
    expect(Object.keys(CATALOGUES).sort()).toEqual(LOCALES.filter((l) => l !== 'en').sort())
  })

  for (const [locale, catalogue] of Object.entries(CATALOGUES)) {
    describe(locale, () => {
      const flat = flatten(catalogue)

      it('defines every key English defines', () => {
        const missing = [...english.keys()].filter((key) => !flat.has(key))
        expect(missing, `${locale} is missing keys`).toEqual([])
      })

      it('defines no keys English does not', () => {
        // A stray key is dead weight nothing will ever read.
        const extra = [...flat.keys()].filter((key) => !english.has(key))
        expect(extra, `${locale} has unknown keys`).toEqual([])
      })

      it('leaves no message empty', () => {
        for (const [key, value] of flat) {
          const texts = typeof value === 'string' ? [value] : Object.values(value as Tree)
          for (const text of texts) {
            expect(String(text).trim(), `${locale}.${key} is empty`).not.toBe('')
          }
        }
      })

      it('uses the same placeholders as English', () => {
        for (const [key, expected] of english) {
          const actual = flat.get(key)
          // A translation that drops {count} renders a sentence with a hole in it.
          expect([...placeholders(actual)].sort(), `${locale}.${key}`).toEqual(
            [...placeholders(expected)].sort(),
          )
        }
      })

      it('gives every counted message an "other" form', () => {
        for (const [key, value] of flat) {
          if (!isPlural(value)) continue
          expect(Object.keys(value), `${locale}.${key} needs an "other" form`).toContain('other')
        }
      })

      it('supplies a form for every plural category the language actually uses', () => {
        const rules = new Intl.PluralRules(locale)
        const used = new Set<string>()
        // Sample the range where the categories differ; Arabic splits at 1, 2,
        // 3-10 and 11-99, so a hundred values covers every one of them.
        for (let n = 0; n <= 110; n++) used.add(rules.select(n))

        for (const [key, value] of flat) {
          if (!isPlural(value)) continue
          const provided = new Set(Object.keys(value))
          const englishForms = english.get(key)
          // Only demand the categories English itself distinguishes plus the
          // ones this language adds; `other` covers anything left over.
          if (!isPlural(englishForms)) continue
          for (const category of used) {
            const covered = provided.has(category) || provided.has('other')
            expect(covered, `${locale}.${key} cannot render "${category}"`).toBe(true)
          }
        }
      })

      it('translates rather than copying English verbatim', () => {
        // Product names and format tokens are the same everywhere; everything
        // else being identical means the catalogue was never translated.
        const SHARED = new Set([
          'app.name',
          'settings.daily.formatTokens',
          'icons.emoji',
          'settings.about.version',
        ])
        const identical = [...english.entries()].filter(
          ([key, value]) =>
            typeof value === 'string' && value.length > 12 && !SHARED.has(key) && flat.get(key) === value,
        )
        expect(
          identical.map(([key]) => key),
          `${locale} left keys untranslated`,
        ).toEqual([])
      })
    })
  }
})
