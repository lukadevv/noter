/**
 * The small sounds that answer what you do: switching tab, pressing a button,
 * creating or deleting something. Drawn as tiny recipes for the same Web Audio
 * engine the alarms use, so there are no audio files to ship.
 *
 * Which sound a button makes follows its role: `data-ui-sound` on the button
 * (or an ancestor) wins, then the button's kind. A click makes exactly one
 * sound, so a handler that knows better (a note was created, a habit was
 * checked) upgrades the click's sound instead of adding a second one.
 */
import { alarm } from './beeps'
import type { SoundRecipe } from '$lib/db/schema'

export const UI_SOUND_IDS = [
  'tab',
  'note',
  'primary',
  'secondary',
  'switchOn',
  'switchOff',
  'create',
  'complete',
  'delete',
  'error',
  'menu',
  'dialog',
] as const

export type UiSoundId = (typeof UI_SOUND_IDS)[number]

export interface UiSoundSettings {
  enabled: boolean
  /** 0-1, applied on top of each sound's own level. */
  volume: number
  /** Sounds the user switched off one by one. */
  muted: UiSoundId[]
}

export const DEFAULT_UI_SOUNDS: UiSoundSettings = { enabled: true, volume: 0.4, muted: [] }

const recipe = (
  wave: SoundRecipe['wave'],
  notes: number[],
  noteMs: number,
  volume: number,
  releaseMs = 50,
): SoundRecipe => ({ wave, notes, noteMs, gapMs: 0, volume, attackMs: 3, releaseMs })

/** Pitches are notes of one scale (A minor pentatonic-ish) so they never clash. */
export const UI_SOUNDS: Record<UiSoundId, SoundRecipe> = {
  tab: recipe('sine', [523.25, 659.25], 45, 0.5, 45),
  note: recipe('triangle', [440, 587.33], 35, 0.35, 40),
  primary: recipe('triangle', [783.99], 70, 0.6, 60),
  secondary: recipe('sine', [493.88], 40, 0.4, 35),
  switchOn: recipe('triangle', [523.25, 783.99], 55, 0.5, 50),
  switchOff: recipe('triangle', [783.99, 523.25], 55, 0.45, 50),
  create: recipe('sine', [880, 1318.51], 70, 0.5, 90),
  complete: recipe('sine', [523.25, 659.25, 783.99], 55, 0.55, 90),
  delete: recipe('triangle', [220, 164.81], 70, 0.6, 70),
  error: recipe('sawtooth', [196, 0, 196], 60, 0.22, 40),
  menu: recipe('sine', [987.77], 30, 0.3, 30),
  dialog: recipe('sine', [587.33, 783.99], 45, 0.4, 45),
}

/** These replace the sound of the click that caused them; the rest never do. */
const UPGRADES: ReadonlySet<UiSoundId> = new Set(['create', 'complete', 'delete', 'error'])

/** The same sound twice inside this window is one sound (a double fire, not a double tap). */
const SAME_SOUND_MS = 40

const isSoundId = (value: string | undefined): value is UiSoundId =>
  UI_SOUND_IDS.includes(value as UiSoundId)

/**
 * The sound a click should make, or null for none. `data-ui-sound` names one
 * (or `none`); otherwise it follows the control: tabs tab, danger buttons
 * delete, primary buttons are louder than the rest.
 */
export function classifyClick(target: Element | null): UiSoundId | null {
  const control = target?.closest('button, [role="button"], [role="tab"], a.btn')
  if (!control || control.matches(':disabled, [aria-disabled="true"]')) return null
  const named = control.closest<HTMLElement>('[data-ui-sound]')?.dataset.uiSound
  if (named === 'none') return null
  if (isSoundId(named)) return named
  if (control.matches('[role="tab"]')) return 'tab'
  if (control.matches('.btn--danger')) return 'delete'
  if (control.matches('.btn--primary')) return 'primary'
  return 'secondary'
}

interface Engine {
  preview(recipe: SoundRecipe, volume?: number): number
  unlock(): void
}

export class UiSounds {
  #settings: () => UiSoundSettings
  #engine: Engine
  #last = new Map<UiSoundId, number>()
  #pending: { id: UiSoundId | null } | null = null

  constructor(settings: () => UiSoundSettings = () => DEFAULT_UI_SOUNDS, engine: Engine = alarm) {
    this.#settings = settings
    this.#engine = engine
  }

  /** Where the live settings come from; called once at startup. */
  configure(settings: () => UiSoundSettings): void {
    this.#settings = settings
  }

  /**
   * Plays a sound now, or, inside a click, upgrades that click's sound. Context
   * menus, dialogs and tabs open as a result of a click, and that click already
   * has a sound, so they stay silent then.
   */
  play(id: UiSoundId, options: { reverse?: boolean } = {}): void {
    if (this.#pending) {
      if (UPGRADES.has(id)) this.#pending.id = id
      return
    }
    this.#sound(id, options.reverse)
  }

  /** Plays for the settings page: ignores the master and per-sound switches. */
  preview(id: UiSoundId): void {
    this.#sound(id, false, true)
  }

  /**
   * Starts a click's sound after the handlers have run, so one of them can
   * still upgrade it. A timeout of zero is short enough to feel instant.
   */
  click(target: Element | null): void {
    const id = classifyClick(target)
    if (!id || this.#pending) return
    const pending = { id }
    this.#pending = pending
    setTimeout(() => {
      this.#pending = null
      if (pending.id) this.#sound(pending.id)
    }, 0)
  }

  /** The browser only allows sound after a gesture; called on the first one. */
  unlock(): void {
    this.#engine.unlock()
  }

  #sound(id: UiSoundId, reverse = false, force = false): void {
    const settings = this.#settings()
    if (!force && (!settings.enabled || settings.muted.includes(id))) return
    const now = Date.now()
    if (!force && now - (this.#last.get(id) ?? 0) < SAME_SOUND_MS) return
    this.#last.set(id, now)
    const base = UI_SOUNDS[id]
    const notes = reverse ? [...base.notes].reverse() : base.notes
    this.#engine.preview({ ...base, notes }, settings.volume)
  }
}

export const uiSound = new UiSounds()

/**
 * Wires the page-wide click and first-gesture listeners. Returns a function
 * that removes them again.
 */
export function initUiSounds(settings: () => UiSoundSettings, root: Document = document): () => void {
  uiSound.configure(settings)
  const onClick = (event: Event) => uiSound.click(event.target as Element | null)
  const unlock = () => uiSound.unlock()
  // Capture, so a handler that stops propagation still gets its click sound.
  root.addEventListener('click', onClick, true)
  root.addEventListener('pointerdown', unlock, { capture: true, once: true })
  root.addEventListener('keydown', unlock, { capture: true, once: true })
  return () => {
    root.removeEventListener('click', onClick, true)
    root.removeEventListener('pointerdown', unlock, true)
    root.removeEventListener('keydown', unlock, true)
  }
}
