import { db } from '../db'
import type { MotionSetting } from '$lib/ui/motion.svelte'

export type Density = 'compact' | 'cozy' | 'comfortable'
export type FontChoice = 'system' | 'sans' | 'serif' | 'mono'

export interface DailyNoteSettings {
  /** Off by default: the app never creates a dated note the user did not ask for. */
  enabled: boolean
  folderId: string
  /** Date pattern for the note title, e.g. 'YYYY-MM-DD'. */
  titleFormat: string
  templateId: string | null
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
  dailyNotes: DailyNoteSettings
  lastFolderId: string | null
  lastNoteId: string | null
  sidebarWidth: number
  listWidth: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeId: 'dark',
  density: 'cozy',
  font: 'system',
  editorFontSize: 15,
  radiusScale: 1,
  motion: 'system',
  showLineNumbers: false,
  dailyNotes: {
    enabled: false,
    folderId: '',
    titleFormat: 'YYYY-MM-DD',
    templateId: null,
  },
  lastFolderId: null,
  lastNoteId: null,
  sidebarWidth: 240,
  listWidth: 320,
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
  return merged as unknown as AppSettings
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: KEY, value: settings })
}
