import { db } from '../db'
import type { MotionSetting } from '$lib/ui/motion.svelte'
import { DEFAULT_UI_SOUNDS, type UiSoundSettings } from '$lib/audio/ui-sounds'
export type { Sound } from '../schema'

export type Density = 'compact' | 'cozy' | 'comfortable'
export type FontChoice = 'system' | 'sans' | 'serif' | 'mono'

export interface DailyNoteSettings {
  /**
   * Remind on Home when today's note is not written yet. The note itself is
   * still only created when opened: the app never makes one on its own.
   */
  homeAlert: boolean
  folderId: string
  /** Date pattern for the note title, e.g. 'YYYY-MM-DD'. */
  titleFormat: string
  templateId: string | null
}

export interface TimerSettings {
  /** 0–1, applied on top of each sound's own volume. */
  volume: number
  /** How long an alarm keeps ringing before it goes quiet, in seconds. */
  ringSeconds: number
  defaultSoundId: string
  /** Default presets are created once; deleting them all must not bring them back. */
  seeded: boolean
}

export interface PomodoroSettings {
  focusMinutes: number
  shortMinutes: number
  longMinutes: number
  /** A long break after this many focus sessions. */
  longEvery: number
  /** Start the next phase by itself when one ends. */
  autoStart: boolean
  soundId: string
}

export interface UpdateSettings {
  /** Look for a new version when the app starts (at most once a day). */
  autoCheck: boolean
  /** When the last automatic check ran. */
  lastCheck: number
  /** A version the user chose to skip. */
  skipped: string
}

export interface VaultSettings {
  /** Minutes without activity before the vault locks itself. */
  autoLockMinutes: number
  /** Lock as soon as the app is hidden (another tab, minimised, phone locked). */
  lockOnHide: boolean
  /** Seconds before a copied secret is wiped from the clipboard; 0 = never. */
  clipboardSeconds: number
}

/** The blocks Home can show, in the order the user chose. */
export const HOME_WIDGETS = [
  'alerts',
  'today',
  'calendar',
  'stats',
  'recent',
  'pinned',
  'focus',
  'habits',
  'activity',
  'topics',
  'vault',
] as const

/**
 * Bumped when the default arrangement changes enough that existing users
 * should get it once. Their choice of what is visible is kept.
 */
export const HOME_LAYOUT_VERSION = 2
export type HomeWidget = (typeof HOME_WIDGETS)[number]

export interface HomeSettings {
  widgets: { id: HomeWidget; visible: boolean }[]
  /** Day key on which the "write today's note" reminder was dismissed. */
  dailyDismissed: string
  layoutVersion: number
}

export interface AppSettings {
  themeId: string
  density: Density
  font: FontChoice
  editorFontSize: number
  radiusScale: number
  /** Animations: follow the OS, or force full, reduced (fades only) or off. */
  motion: MotionSetting
  showLineNumbers: boolean
  /** The row of block buttons under the editor, for people who do not use `/`. */
  showInsertBar: boolean
  /** Notes listed under their folder in the sidebar, like files in a file tree. */
  showNotesInTree: boolean
  /** Folders whose notes are unfolded in the sidebar tree. Kept apart from `collapsed`, which is about subfolders. */
  treeNotesOpen: string[]
  dailyNotes: DailyNoteSettings
  lastFolderId: string | null
  lastNoteId: string | null
  sidebarWidth: number
  listWidth: number
  /** The folder sidebar folded away on wide screens (Mod+\\). */
  sidebarCollapsed: boolean
  /** What opening the app shows first. */
  startSection: 'home' | 'notes'
  timers: TimerSettings
  pomodoro: PomodoroSettings
  /** The small sounds that answer clicks, tabs and the like (not the alarms). */
  sounds: UiSoundSettings
  /** The welcome tour was finished or skipped. */
  tourDone: boolean
  updates: UpdateSettings
  /** Show a system notification when a timer or a dose is due. */
  notifications: boolean
  vault: VaultSettings
  home: HomeSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'dark',
  density: 'cozy',
  font: 'system',
  editorFontSize: 15,
  radiusScale: 1,
  motion: 'system',
  showLineNumbers: false,
  showInsertBar: true,
  showNotesInTree: true,
  treeNotesOpen: [],
  dailyNotes: {
    homeAlert: true,
    folderId: '',
    titleFormat: 'YYYY-MM-DD',
    templateId: null,
  },
  lastFolderId: null,
  lastNoteId: null,
  sidebarWidth: 240,
  listWidth: 320,
  sidebarCollapsed: false,
  startSection: 'home',
  timers: { volume: 0.8, ringSeconds: 60, defaultSoundId: 'classic', seeded: false },
  pomodoro: {
    focusMinutes: 25,
    shortMinutes: 5,
    longMinutes: 15,
    longEvery: 4,
    autoStart: false,
    soundId: 'bell',
  },
  sounds: { ...DEFAULT_UI_SOUNDS },
  tourDone: false,
  updates: { autoCheck: true, lastCheck: 0, skipped: '' },
  notifications: true,
  vault: { autoLockMinutes: 5, lockOnHide: true, clipboardSeconds: 30 },
  home: {
    widgets: HOME_WIDGETS.map((id) => ({ id, visible: true })),
    dailyDismissed: '',
    layoutVersion: HOME_LAYOUT_VERSION,
  },
}

const KEY = 'app'

/**
 * Boot-critical settings are mirrored to localStorage so the first paint can
 * apply the right theme synchronously, before IndexedDB has even opened.
 */
const BOOT_MIRROR_KEY = 'noter.boot'

export interface BootMirror {
  themeId: string
  density: Density
  font: FontChoice
  radiusScale: number
  tokens: Record<string, string>
}

export function readBootMirror(): BootMirror | null {
  try {
    const raw = localStorage.getItem(BOOT_MIRROR_KEY)
    return raw ? (JSON.parse(raw) as BootMirror) : null
  } catch {
    return null
  }
}

export function writeBootMirror(mirror: BootMirror): void {
  try {
    localStorage.setItem(BOOT_MIRROR_KEY, JSON.stringify(mirror))
  } catch {
    // Private-mode quota errors are not worth surfacing: the mirror is a cache.
  }
}

export async function loadSettings(): Promise<AppSettings> {
  const row = await db.settings.get(KEY)
  return migrateSettings((row?.value ?? {}) as Partial<AppSettings> & LegacySettings)
}

/** Fields older builds stored that have since been replaced. */
interface LegacySettings {
  reduceMotion?: boolean
}

/**
 * Fills in defaults and upgrades old shapes. Nested groups are merged key by
 * key, so a setting added to a group later still gets its default for users
 * whose stored group predates it.
 */
export function migrateSettings(stored: Partial<AppSettings> & LegacySettings): AppSettings {
  const { reduceMotion, ...rest } = stored
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS, ...rest }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    const current = (rest as Record<string, unknown>)[key]
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object'
    ) {
      merged[key] = { ...value, ...current }
    }
  }
  // The old checkbox was "Reduce motion"; people who ticked it wanted none.
  if (reduceMotion === true && rest.motion === undefined) merged.motion = 'off'

  // Daily notes used to need switching on; now they always open and the
  // switch became the Home reminder.
  const daily = merged.dailyNotes as DailyNoteSettings & { enabled?: boolean }
  if ('enabled' in daily) {
    const { enabled: _enabled, ...kept } = daily
    merged.dailyNotes = kept
  }

  const home = merged.home as HomeSettings
  // A new default arrangement is applied once, keeping what the user hid.
  // (Stored settings without a version predate versioning, hence the 1.)
  if ((stored.home?.layoutVersion ?? (stored.home ? 1 : HOME_LAYOUT_VERSION)) < HOME_LAYOUT_VERSION) {
    const hidden = new Set(home.widgets.filter((w) => !w.visible).map((w) => w.id as string))
    home.widgets = HOME_WIDGETS.map((id) => ({ id, visible: !hidden.has(id) }))
    home.layoutVersion = HOME_LAYOUT_VERSION
  }
  // Widgets added in a later version join the end of the user's own order.
  const known = home.widgets.filter((w) => (HOME_WIDGETS as readonly string[]).includes(w.id))
  const missing = HOME_WIDGETS.filter((id) => !known.some((w) => w.id === id))
  merged.home = { ...home, widgets: [...known, ...missing.map((id) => ({ id, visible: true }))] }
  return merged as unknown as AppSettings
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: KEY, value: settings })
}
