import type { Route } from '../../routes/router'

/**
 * The welcome tour: one stop per area of the app. Each step can move to a
 * route first, then point at an element by selector. When the element is not
 * on screen (a phone layout, a hidden widget) the step shows centred instead,
 * so the tour never gets stuck pointing at nothing.
 */
export interface TourStep {
  id: string
  icon: string
  /** Where to go before showing the step. */
  route?: Route
  /** CSS selectors tried in order; the first visible match is highlighted. */
  target?: string[]
}

export const TOUR: TourStep[] = [
  { id: 'welcome', icon: 'sparkles' },
  { id: 'nav', icon: 'compass', target: ['[data-tour="nav"]'] },
  { id: 'home', icon: 'house', route: { kind: 'home' }, target: ['[data-tour="home-actions"]'] },
  {
    id: 'customize',
    icon: 'layout-dashboard',
    route: { kind: 'home' },
    target: ['[data-tour="customize-home"]'],
  },
  {
    id: 'notes',
    icon: 'notebook',
    route: { kind: 'notes', folderId: null, noteId: null },
    target: ['[data-testid="new-note"]', '[data-tour="nav-notes"]'],
  },
  {
    id: 'timers',
    icon: 'timer',
    route: { kind: 'timers', tab: 'alarms' },
    target: ['[data-tour="timer-tabs"]'],
  },
  { id: 'habits', icon: 'target', route: { kind: 'habits' }, target: ['[data-testid="add-habit"]'] },
  { id: 'meds', icon: 'pill', route: { kind: 'meds' }, target: ['[data-testid="add-med"]'] },
  { id: 'vault', icon: 'shield', route: { kind: 'vault' }, target: ['[data-tour="nav-vault"]'] },
  { id: 'search', icon: 'search', route: { kind: 'home' }, target: ['[data-tour="search"]'] },
  { id: 'done', icon: 'party-popper', route: { kind: 'home' } },
]
