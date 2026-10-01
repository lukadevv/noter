/**
 * Persisted record shapes.
 *
 * Two IndexedDB constraints shape these types, so they are stated once here:
 *  - `null` and `boolean` are not valid IndexedDB keys. Any field we want to
 *    index is therefore either a `Flag` (0 | 1) or uses a numeric/string
 *    sentinel (`0` for "no timestamp", `ROOT` for "no parent").
 *  - A genuinely nullable indexed field is still useful when we only ever query
 *    the non-null side, because the index stays sparse. `daily` and `system`
 *    exploit that: their indexes contain only daily notes and only singletons.
 *
 * Every record carries a uuid `id` and an `updatedAt` timestamp from day one so
 * a future sync layer has something to reconcile on.
 */

/** Indexable boolean. IndexedDB refuses to key on real booleans. */
export type Flag = 0 | 1

/** Sentinel for "no parent folder", since `null` cannot be indexed. */
export const ROOT = ''

/** How a note's markdown body is presented. The body itself is always markdown. */
export type ViewMode = 'doc' | 'checklist' | 'board' | 'gallery' | 'code'

export const VIEW_MODES: ViewMode[] = ['doc', 'checklist', 'board', 'gallery', 'code']

/** Icon reference: either a Lucide icon name or a literal emoji. */
export type IconRef = `lucide:${string}` | `emoji:${string}`

export interface Folder {
  id: string
  name: string
  /** Parent folder id, or ROOT. */
  parentId: string
  icon: IconRef
  /** Per-folder accent, overriding the active theme's accent while inside it. */
  color: string | null
  order: number
  collapsed: boolean
  encrypted: Flag
  /** Key-derivation parameters; only present once the folder has been locked. */
  kdf: { salt: string; iterations: number } | null
  /**
   * A known token encrypted with the folder key, so a wrong passphrase is
   * rejected up front rather than silently producing unreadable notes.
   */
  verifier: string | null
  createdAt: number
  updatedAt: number
}

export interface Note {
  id: string
  title: string
  /** Owning folder id, or ROOT for unfiled notes. */
  folderId: string
  /** Markdown source, or the ciphertext envelope when `encrypted` is 1. */
  body: string
  view: ViewMode
  tags: string[]
  /** Pinned to the top of every list. */
  pinned: Flag
  /** Pinned only within its own folder. */
  pinnedInFolder: Flag
  order: number
  color: string | null
  icon: IconRef | null
  /** Column key for the `board` view. */
  status: string | null
  /** Language hint for the `code` view. */
  lang: string | null
  /** Offered under "New note from template". */
  template: Flag
  /** Timestamp, or 0 when not archived. */
  archivedAt: number
  /** Timestamp, or 0 when not trashed. Purged after TRASH_RETENTION_DAYS. */
  deletedAt: number
  encrypted: Flag
  /**
   * Image ids an encrypted note references. The body is ciphertext, so the
   * orphan sweep cannot read them out of it; the images themselves are stored
   * unencrypted anyway, so listing their ids here reveals nothing new.
   */
  assetRefs?: string[]
  /**
   * Locked for editing: the note opens read-only until unlocked, which guards
   * against accidental rewrites. Absent on notes older than the feature.
   * (Not to be confused with an encrypted note being "locked" by its folder.)
   */
  editLock?: Flag
  /** 'YYYY-MM-DD' when this is a daily note; null otherwise (sparse index). */
  daily: string | null
  /** Singleton notes the app manages itself; null otherwise (sparse index). */
  system: 'scratchpad' | null
  createdAt: number
  updatedAt: number
}

export interface Asset {
  id: string
  /** SHA-256 of the original bytes, used to deduplicate repeated pastes. */
  hash: string
  blob: Blob
  /** Downscaled copy used by lists and grids so they never decode full images. */
  thumb: Blob
  mime: string
  width: number
  height: number
  bytes: number
  origin: 'paste' | 'file' | 'url' | 'share'
  /** Set for images fetched from a URL, kept for attribution. */
  sourceUrl: string | null
  createdAt: number
}

export interface Version {
  id: string
  noteId: string
  title: string
  body: string
  createdAt: number
}

export interface SmartFolder {
  id: string
  name: string
  icon: IconRef
  color: string | null
  /** Query source, e.g. `tag:bug AND pinned AND modified:<7d`. */
  query: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface Theme {
  id: string
  name: string
  builtin: boolean
  /**
   * The compact description the user edits. Kept so a theme can be re-derived
   * if the derivation improves; `tokens` is the snapshot that gets applied.
   */
  seed: ThemeSeedRecord | null
  /** CSS custom property name (without the leading `--`) to value. */
  tokens: Record<string, string>
  createdAt: number
  updatedAt: number
}

/** Storage shape of a theme seed. Mirrors ThemeSeed in lib/theme/tokens.ts. */
export interface ThemeSeedRecord {
  mode: 'light' | 'dark'
  neutralHue: number
  neutralChroma: number
  accent: { l: number; c: number; h: number }
  danger: { l: number; c: number; h: number }
  warn: { l: number; c: number; h: number }
  ok: { l: number; c: number; h: number }
}

export interface Setting<T = unknown> {
  key: string
  value: T
}

export const TRASH_RETENTION_DAYS = 30

export function now(): number {
  return Date.now()
}

export function flag(value: boolean): Flag {
  return value ? 1 : 0
}

// --- Timers ------------------------------------------------------------------

/** A synthesised alarm sound: a short note pattern played on an oscillator. */
export interface SoundRecipe {
  wave: 'sine' | 'square' | 'triangle' | 'sawtooth'
  /** Pitches in Hz, played in turn; 0 is a rest. */
  notes: number[]
  /** Length of each note, ms. */
  noteMs: number
  /** Silence after the whole pattern before it repeats, ms. */
  gapMs: number
  /** 0–1. Multiplied by the global alarm volume. */
  volume: number
  /** A soft attack and a longer release make a bell; short ones make a beep. */
  attackMs: number
  releaseMs: number
}

export interface Sound {
  id: string
  name: string
  recipe: SoundRecipe
  createdAt: number
  updatedAt: number
}

/** A timer you start with one tap: "Oven, 10 min". */
export interface TimerPreset {
  id: string
  label: string
  seconds: number
  /** A built-in sound id ('classic', 'bell'…) or a custom Sound id. */
  soundId: string
  color: string | null
  /** Starts again by itself when it rings, e.g. "stand up every 45 minutes". */
  repeat: Flag
  order: number
  createdAt: number
  updatedAt: number
}

/** A timer that is counting down (or paused, or ringing). */
export interface RunningTimer {
  id: string
  presetId: string | null
  label: string
  /** The full duration, for the progress ring. */
  seconds: number
  /** When it rings, as a timestamp; 0 while paused. */
  endAt: number
  /** Milliseconds left while paused; null while running. */
  pausedRemaining: number | null
  soundId: string
  repeat: Flag
  /** When it rang, 0 until then. Claimed in a transaction so only one tab rings. */
  firedAt: number
  createdAt: number
  /** A plain countdown (absent in older rows) or one phase of a pomodoro. */
  kind?: 'timer' | 'pomodoro'
  /** For pomodoro timers: which phase this countdown is. */
  phase?: PomodoroPhase
  /** For pomodoro timers: focus sessions finished in the current set, before this one. */
  cycle?: number
}

export type PomodoroPhase = 'focus' | 'short' | 'long'

/** One finished pomodoro focus session, for the focus statistics. */
export interface FocusSession {
  id: string
  /** Local day key, YYYY-MM-DD. */
  day: string
  startedAt: number
  minutes: number
  createdAt: number
  updatedAt: number
}

/** The stopwatch. A single row (id 'main'), so it survives reloads and syncs across tabs. */
export interface Stopwatch {
  id: string
  /** When the current run started; 0 while stopped. */
  startedAt: number
  /** Milliseconds from earlier runs (before the last pause). */
  accumulated: number
  /** Total elapsed at each lap press, in milliseconds, oldest first. */
  laps: number[]
  updatedAt: number
}

// --- Medication --------------------------------------------------------------

export interface Med {
  id: string
  name: string
  /** Free text: "500 mg", "2 drops", "1 tablet". */
  dose: string
  color: string | null
  /** Hours between doses: 24 = daily, 12 = twice a day, 8 = three times. */
  intervalHours: number
  /** How long before a dose the "coming up" alert appears, in minutes. */
  leadMinutes: number
  notes: string
  /** Pills or doses left, or null when not tracked. */
  stock: number | null
  /** How much one dose uses from the stock. */
  perDose: number
  /** Paused medications keep their history but stop reminding. */
  active: Flag
  /**
   * The due time a reminder was last fired for. Claimed in a transaction so a
   * dose reminds once, not once per open tab.
   */
  notifiedDue: number
  order: number
  createdAt: number
  updatedAt: number
}

export interface Dose {
  id: string
  medId: string
  /** When it was taken (or, for a skipped dose, when it was skipped). */
  takenAt: number
  status: 'taken' | 'skipped'
  createdAt: number
  updatedAt: number
}

// --- Habits ------------------------------------------------------------------

export type HabitSchedule =
  | { kind: 'daily' }
  /** Specific weekdays, 0 = Sunday … 6 = Saturday. */
  | { kind: 'weekdays'; days: number[] }
  /** Any days, so many times a week. */
  | { kind: 'perWeek'; times: number }

export interface Habit {
  id: string
  name: string
  /** A Lucide icon name. */
  icon: string
  color: string | null
  schedule: HabitSchedule
  /** How many times a day counts as done: 1 for most, 8 for "glasses of water". */
  target: number
  /** Local "HH:MM" to remind at when not done yet, or null. */
  reminderTime: string | null
  /** The day key a reminder last fired for, so it fires once a day. */
  notifiedDay: string
  archived: Flag
  order: number
  createdAt: number
  updatedAt: number
}

/** Progress on one habit on one day. */
export interface HabitCheck {
  /** `${habitId}:${day}` - one row per habit and day. */
  id: string
  habitId: string
  /** Local day key, YYYY-MM-DD. */
  day: string
  count: number
  createdAt: number
  updatedAt: number
}

// --- Vault (secrets) ---------------------------------------------------------

/**
 * How the vault's data key is protected. The data key is random and encrypts
 * every item; it is stored here wrapped (encrypted) by a key derived from the
 * master password. Changing the password only re-wraps this one key.
 */
export interface SecretsMeta {
  id: 'main'
  kdf: { salt: string; iterations: number }
  /** The wrapped data key and the IV used to wrap it, base64. */
  wrapped: string
  iv: string
  /** Random id of the data key, so a backup from another vault is recognised. */
  keyId: string
  createdAt: number
  updatedAt: number
}

/** One vault entry. Everything about it, title included, is inside `envelope`. */
export interface SecretItem {
  id: string
  envelope: string
  order: number
  createdAt: number
  updatedAt: number
}

/**
 * One day of writing activity, for the Home dashboard. Only numbers are kept:
 * no titles or text, so it reveals nothing even for encrypted notes.
 */
export interface ActivityDay {
  /** 'YYYY-MM-DD' in local time. */
  day: string
  /** Saved edit batches (a burst of typing is one). */
  edits: number
  created: number
  /** Words added; deletions do not subtract. */
  words: number
  updatedAt: number
}
