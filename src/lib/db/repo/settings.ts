import { db } from '../db'

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
  reduceMotion: boolean
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
  reduceMotion: false,
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
  const stored = (row?.value ?? {}) as Partial<AppSettings>
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    dailyNotes: { ...DEFAULT_SETTINGS.dailyNotes, ...(stored.dailyNotes ?? {}) },
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await db.settings.put({ key: KEY, value: settings })
}
