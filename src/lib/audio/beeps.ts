import type { SoundRecipe } from '$lib/db/schema'

/**
 * Alarm sounds, synthesised with the Web Audio API.
 *
 * No audio files: every sound is a short recipe — a waveform, a few pitches,
 * an envelope — so the built-in set costs a few hundred bytes, works offline,
 * and users can design their own "custom beeps" with the same knobs.
 */

export const BUILTIN_SOUNDS: { id: string; label: string; recipe: SoundRecipe }[] = [
  {
    id: 'classic',
    label: 'sounds.classic',
    recipe: {
      wave: 'square',
      notes: [880, 0, 880, 0, 880, 0, 880],
      noteMs: 110,
      gapMs: 650,
      volume: 0.35,
      attackMs: 4,
      releaseMs: 30,
    },
  },
  {
    id: 'bell',
    label: 'sounds.bell',
    recipe: {
      wave: 'sine',
      notes: [1318.5, 987.77],
      noteMs: 650,
      gapMs: 500,
      volume: 0.8,
      attackMs: 4,
      releaseMs: 620,
    },
  },
  {
    id: 'digital',
    label: 'sounds.digital',
    recipe: {
      wave: 'square',
      notes: [1046.5, 1318.5, 1568, 2093],
      noteMs: 90,
      gapMs: 520,
      volume: 0.3,
      attackMs: 3,
      releaseMs: 25,
    },
  },
  {
    id: 'soft',
    label: 'sounds.soft',
    recipe: {
      wave: 'triangle',
      notes: [523.25, 659.25, 783.99, 1046.5],
      noteMs: 240,
      gapMs: 900,
      volume: 0.7,
      attackMs: 30,
      releaseMs: 220,
    },
  },
  {
    id: 'urgent',
    label: 'sounds.urgent',
    recipe: {
      wave: 'sawtooth',
      notes: [987.77, 739.99, 987.77, 739.99],
      noteMs: 130,
      gapMs: 140,
      volume: 0.28,
      attackMs: 3,
      releaseMs: 20,
    },
  },
  {
    id: 'pulse',
    label: 'sounds.pulse',
    recipe: {
      wave: 'sine',
      notes: [440],
      noteMs: 220,
      gapMs: 520,
      volume: 0.8,
      attackMs: 20,
      releaseMs: 180,
    },
  },
]

export const DEFAULT_SOUND_ID = 'classic'

/** Scientific note names to Hz: "A4" → 440, "C#5" → 554.37, "-" → rest. */
export function noteToHz(name: string): number | null {
  const trimmed = name.trim()
  if (trimmed === '-' || trimmed === '_') return 0
  const match = /^([A-Ga-g])([#b]?)(\d)$/.exec(trimmed)
  if (!match) return null
  const semis: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }
  let n = semis[match[1]!.toUpperCase()]! + (Number(match[3]) - 4) * 12
  if (match[2] === '#') n++
  if (match[2] === 'b') n--
  return Math.round(440 * 2 ** (n / 12) * 100) / 100
}

/** Hz back to the nearest note name, for editing a recipe as text. */
export function hzToNote(hz: number): string {
  if (hz <= 0) return '-'
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const n = Math.round(12 * Math.log2(hz / 440)) + 57
  return `${names[((n % 12) + 12) % 12]}${Math.floor(n / 12)}`
}

/** Parses "A5 A5 - A5" into pitches; null when any token is not a note. */
export function parseMelody(text: string): number[] | null {
  const tokens = text.split(/[\s,]+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 32) return null
  const notes = tokens.map(noteToHz)
  return notes.every((n) => n !== null) ? (notes as number[]) : null
}

/** One pattern's length in ms, gap included. */
export function patternMs(recipe: SoundRecipe): number {
  return recipe.notes.length * recipe.noteMs + recipe.gapMs
}

type AudioContextCtor = typeof AudioContext

class AlarmPlayer {
  #ctx: AudioContext | null = null
  #loops = new Map<string, { stop: () => void }>()

  #context(): AudioContext | null {
    if (this.#ctx) return this.#ctx
    const Ctor: AudioContextCtor | undefined =
      globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
    if (!Ctor) return null
    this.#ctx = new Ctor()
    return this.#ctx
  }

  /**
   * Browsers only let a page make sound after the user interacted with it.
   * Called from the click that starts a timer, so the alarm can ring later.
   */
  unlock(): void {
    const ctx = this.#context()
    if (ctx && ctx.state === 'suspended') void ctx.resume()
  }

  get unlocked(): boolean {
    return this.#ctx?.state === 'running'
  }

  /** Plays one pass of a pattern. Returns when it would finish, in ms. */
  #playOnce(recipe: SoundRecipe, volume: number): number {
    const ctx = this.#context()
    if (!ctx) return patternMs(recipe)
    const start = ctx.currentTime + 0.02
    const step = recipe.noteMs / 1000
    const peak = Math.max(0.0001, Math.min(1, recipe.volume * volume))
    recipe.notes.forEach((hz, i) => {
      if (hz <= 0) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = recipe.wave
      osc.frequency.value = hz
      const t0 = start + i * step
      const attack = recipe.attackMs / 1000
      const release = Math.max(0.01, recipe.releaseMs / 1000)
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(peak, t0 + attack)
      gain.gain.setValueAtTime(peak, t0 + Math.max(attack, step - release))
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(attack + 0.01, step - release) + release)
      osc.connect(gain).connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + step + release + 0.05)
    })
    return patternMs(recipe)
  }

  /**
   * A single pass, for previews in the sound picker and editor. Returns how
   * long it sounds, in ms, so a picker can show it playing until it ends.
   */
  preview(recipe: SoundRecipe, volume = 1): number {
    this.unlock()
    this.#playOnce(recipe, volume)
    return recipe.notes.length * recipe.noteMs + recipe.releaseMs
  }

  /**
   * Repeats a sound until `stop` is called or `maxMs` passes, whichever is
   * first. Keyed so the same alarm never rings twice over itself.
   */
  ring(key: string, recipe: SoundRecipe, volume = 1, maxMs = 60_000): void {
    if (this.#loops.has(key)) return
    this.unlock()
    const until = Date.now() + maxMs
    let timer: ReturnType<typeof setTimeout> | undefined
    const loop = () => {
      if (Date.now() > until) {
        this.stop(key)
        return
      }
      timer = setTimeout(loop, this.#playOnce(recipe, volume))
    }
    this.#loops.set(key, { stop: () => clearTimeout(timer) })
    loop()
  }

  stop(key: string): void {
    this.#loops.get(key)?.stop()
    this.#loops.delete(key)
  }

  stopAll(): void {
    for (const key of [...this.#loops.keys()]) this.stop(key)
  }
}

export const alarm = new AlarmPlayer()
