/**
 * Moving between the app's areas.
 *
 * Every section has a URL, so navigation is just a hash change and the router
 * in App.svelte does the rest. Browser Back therefore works between sections,
 * and a reload lands where you were.
 */
import { ALL_NOTES, formatRoute, navigate, type Route, type Section } from '../routes/router'

/** Where to return when the settings page closes. */
let beforeSettings: string | null = null

export function goTo(section: Section): void {
  const routes: Record<Section, Route> = {
    home: { kind: 'home' },
    notes: ALL_NOTES,
    vault: { kind: 'vault' },
    meds: { kind: 'meds' },
    timers: { kind: 'timers' },
  }
  navigate(routes[section])
}

export function openSettings(section: string | null = null): void {
  if (!location.hash.startsWith('#/settings')) beforeSettings = location.hash || '#/'
  navigate({ kind: 'settings', section })
}

export function closeSettings(): void {
  const target = beforeSettings ?? formatRoute({ kind: 'home' })
  beforeSettings = null
  location.hash = target
}
