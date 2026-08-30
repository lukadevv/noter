import { LOCALES, LOCALE_INFO } from './i18n/types'

/**
 * Structured data for search engines.
 *
 * This lives in a module rather than inline in `index.html` so the numbers and
 * feature list come from one place and are built at compile time, and so the
 * shape is type-checked rather than being a JSON blob nobody dares touch.
 */

export const SITE_NAME = 'Noter'

export const SITE_DESCRIPTION =
  'A note-taking app that runs entirely in your browser. Folders, images, checklists and search, ' +
  'with your notes stored on your own device and no account to create.'

export const SITE_TAGLINE = 'Local-first notes that work offline'

/** Written for a person deciding whether to click, not for keyword stuffing. */
const FEATURES = [
  'Works offline as an installable progressive web app',
  'Notes stored on your device in IndexedDB, with no account and no server',
  'Markdown notes with document, checklist, board, gallery and code views',
  'Nested folders, tags, wiki-links and backlinks',
  'Full-text search and a command palette',
  'Paste, drop or link images, stored and compressed locally',
  'Per-folder encryption with AES-GCM',
  'Encrypted portable backups and Markdown export',
  'Ten interface languages, including right-to-left Arabic',
]

/**
 * `og:locale` wants the underscore form, and the alternates tell a crawler the
 * same page serves other languages. There are no per-language URLs, so this is
 * deliberately not `hreflang`: that would promise addresses that do not exist.
 */
const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  es: 'es_ES',
  pt: 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  zh: 'zh_CN',
  ja: 'ja_JP',
  ko: 'ko_KR',
  ar: 'ar_AR',
}

export function ogLocale(locale: string): string {
  return OG_LOCALES[locale] ?? 'en_US'
}

export function alternateOgLocales(): string[] {
  return LOCALES.filter((locale) => locale !== 'en').map(ogLocale)
}

/**
 * JSON-LD describing the app.
 *
 * `SoftwareApplication` is the type that earns a rich result for a tool like
 * this; `offers` at zero is what marks it as free, and omitting it makes some
 * validators complain rather than assume.
 */
export function structuredData(siteUrl: string, version: string): string {
  const base = siteUrl || ''

  const application = {
    '@type': 'SoftwareApplication',
    '@id': `${base}/#app`,
    name: SITE_NAME,
    alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    applicationCategory: 'ProductivityApplication',
    applicationSubCategory: 'Note-taking',
    operatingSystem: 'Any (web browser)',
    browserRequirements: 'Requires a browser with IndexedDB and service worker support.',
    url: base ? `${base}/` : undefined,
    image: base ? `${base}/og.png` : undefined,
    screenshot: base ? `${base}/og.png` : undefined,
    softwareVersion: version,
    inLanguage: [...LOCALES],
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    featureList: FEATURES,
    permissions: 'No account, no network access, no personal data collected.',
  }

  const website = {
    '@type': 'WebSite',
    '@id': `${base}/#website`,
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: base ? `${base}/` : undefined,
    inLanguage: 'en',
  }

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [application, website],
  }

  // Undefined members are dropped by JSON.stringify, so an unset site URL simply
  // omits the fields that would otherwise be relative and meaningless.
  return JSON.stringify(graph)
}

/** Locale metadata, exported for the language-aware parts of the head. */
export { LOCALES, LOCALE_INFO }
