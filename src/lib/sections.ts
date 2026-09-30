import type { Section } from '../routes/router'

export interface SectionEntry {
  id: Section
  icon: string
  /** i18n key of the label. */
  label: string
  /** Shortcut hint shown in tooltips, in "Mod+1" form. */
  shortcut: string
}

/**
 * The navigation rail and bottom bar, in order. Adding a section is adding a
 * row here, a route in router.ts and a component in App.svelte.
 */
export const SECTIONS: SectionEntry[] = [
  { id: 'home', icon: 'house', label: 'nav.home', shortcut: 'Mod+1' },
  { id: 'notes', icon: 'notebook', label: 'nav.notes', shortcut: 'Mod+2' },
  { id: 'timers', icon: 'timer', label: 'nav.timers', shortcut: 'Mod+3' },
  { id: 'meds', icon: 'pill', label: 'nav.meds', shortcut: 'Mod+4' },
]
