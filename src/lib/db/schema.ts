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
