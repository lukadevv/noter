import type { Section } from '../routes/router'

export interface SectionEntry {
  id: Section
  icon: string
  /** i18n key of the full name, used for tooltips and page titles. */
  label: string
  /** i18n key of the short name printed under the icon. */
  short: string
  /** Shortcut hint shown in tooltips, in "Mod+1" form. */
  shortcut: string
}

/**
 * The navigation rail and bottom bar, in order. Adding a section is adding a
 * row here, a route in router.ts and a component in App.svelte.
 */
export const SECTIONS: SectionEntry[] = [
  { id: 'home', icon: 'house', label: 'nav.home', short: 'nav.short.home', shortcut: 'Mod+1' },
  { id: 'notes', icon: 'notebook', label: 'nav.notes', short: 'nav.short.notes', shortcut: 'Mod+2' },
  { id: 'timers', icon: 'timer', label: 'nav.timers', short: 'nav.short.timers', shortcut: 'Mod+3' },
  { id: 'habits', icon: 'target', label: 'nav.habits', short: 'nav.short.habits', shortcut: 'Mod+4' },
  { id: 'meds', icon: 'pill', label: 'nav.meds', short: 'nav.short.meds', shortcut: 'Mod+5' },
  { id: 'vault', icon: 'shield', label: 'nav.vault', short: 'nav.short.vault', shortcut: 'Mod+6' },
]
