/**
 * Renders sound effects to WAV inside Chromium, with an OfflineAudioContext.
 *
 * `app-*` sounds are the app's own alarm recipes from src/lib/audio/beeps.ts,
 * played through the same oscillator-and-envelope chain the app uses, so the
 * trailer rings exactly like Noter does.
 *
 * The rest are simple synthesised stand-ins for the interface effects. They
 * are only used when no file with that name is in .trailer/assets/sfx/; the
 * runner warns about each one.
 */
import { BUILTIN_SOUNDS } from '$lib/audio/beeps'
import type { SoundRecipe } from '$lib/db/schema'

const RATE = 48_000

type Render = (ctx: OfflineAudioContext) => void

/** Mirrors AlarmPlayer.#playOnce in beeps.ts, for one pass of a recipe. */
function recipe(r: SoundRecipe): { seconds: number; render: Render } {
  const step = r.noteMs / 1000
  const release = Math.max(0.01, r.releaseMs / 1000)
  return {
    seconds: r.notes.length * step + release + 0.2,
    render(ctx) {
      const start = 0.01
      const peak = Math.max(0.0001, Math.min(1, r.volume))
      r.notes.forEach((hz, i) => {
        if (hz <= 0) return
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = r.wave
        osc.frequency.value = hz
        const t0 = start + i * step
        const attack = r.attackMs / 1000
        gain.gain.setValueAtTime(0.0001, t0)
        gain.gain.exponentialRampToValueAtTime(peak, t0 + attack)
        gain.gain.setValueAtTime(peak, t0 + Math.max(attack, step - release))
        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          t0 + Math.max(attack + 0.01, step - release) + release,
        )
        osc.connect(gain).connect(ctx.destination)
        osc.start(t0)
        osc.stop(t0 + step + release + 0.05)
      })
    },
  }
}

function noise(ctx: OfflineAudioContext, seconds: number): AudioBufferSourceNode {
  const buffer = ctx.createBuffer(1, Math.ceil(seconds * RATE), RATE)
  const data = buffer.getChannelData(0)
  let seed = 12345
  for (let i = 0; i < data.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    data[i] = (seed / 0x7fffffff) * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = buffer
  return source
}

function envelope(ctx: OfflineAudioContext, points: [number, number][]): GainNode {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, 0)
  for (const [time, value] of points) gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, value), time)
  return gain
}

function tone(
  ctx: OfflineAudioContext,
  type: OscillatorType,
  hz: number,
  at: number,
  points: [number, number][],
) {
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.value = hz
  // Silent until `at`, then the envelope from there.
  const timed: [number, number][] = points.map(([t, v]) => [at + t, v])
  const gain = envelope(ctx, at > 0 ? [[at, 0.0001], ...timed] : timed)
  osc.connect(gain).connect(ctx.destination)
  osc.start(at)
  osc.stop(at + points[points.length - 1]![0] + 0.05)
  return osc
}

function filteredNoise(
  ctx: OfflineAudioContext,
  seconds: number,
  type: BiquadFilterType,
  hz: number,
  q: number,
  points: [number, number][],
): BiquadFilterNode {
  const source = noise(ctx, seconds)
  const filter = ctx.createBiquadFilter()
  filter.type = type
  filter.frequency.value = hz
  filter.Q.value = q
  source.connect(filter).connect(envelope(ctx, points)).connect(ctx.destination)
  source.start(0)
  return filter
}

const SYNTH: Record<string, { seconds: number; render: Render }> = {
  click: {
    seconds: 0.12,
    render(ctx) {
      filteredNoise(ctx, 0.12, 'bandpass', 3200, 1.2, [
        [0.002, 0.5],
        [0.04, 0.0001],
      ])
      tone(ctx, 'sine', 1750, 0, [
        [0.002, 0.25],
        [0.05, 0.0001],
      ])
    },
  },
  key: {
    seconds: 0.08,
    render(ctx) {
      filteredNoise(ctx, 0.08, 'bandpass', 4200, 2, [
        [0.002, 0.35],
        [0.03, 0.0001],
      ])
    },
  },
  pop: {
    seconds: 0.2,
    render(ctx) {
      const osc = tone(ctx, 'sine', 520, 0, [
        [0.005, 0.5],
        [0.16, 0.0001],
      ])
      osc.frequency.setValueAtTime(520, 0)
      osc.frequency.exponentialRampToValueAtTime(980, 0.08)
    },
  },
  ding: {
    seconds: 1.2,
    render(ctx) {
      tone(ctx, 'sine', 1567.98, 0, [
        [0.005, 0.45],
        [1.1, 0.0001],
      ])
      tone(ctx, 'sine', 2349.32, 0, [
        [0.005, 0.15],
        [0.7, 0.0001],
      ])
    },
  },
  whoosh: {
    seconds: 0.8,
    render(ctx) {
      const filter = filteredNoise(ctx, 0.8, 'bandpass', 400, 1.4, [
        [0.35, 0.45],
        [0.75, 0.0001],
      ])
      filter.frequency.setValueAtTime(350, 0)
      filter.frequency.exponentialRampToValueAtTime(2600, 0.35)
      filter.frequency.exponentialRampToValueAtTime(700, 0.75)
    },
  },
  lock: {
    seconds: 0.35,
    render(ctx) {
      filteredNoise(ctx, 0.35, 'highpass', 2500, 0.8, [
        [0.002, 0.5],
        [0.03, 0.0001],
      ])
      tone(ctx, 'triangle', 140, 0, [
        [0.004, 0.6],
        [0.12, 0.0001],
      ])
      filteredNoise(ctx, 0.35, 'bandpass', 5200, 3, [
        [0.1, 0.0001],
        [0.102, 0.35],
        [0.14, 0.0001],
      ])
    },
  },
  riser: {
    seconds: 2.8,
    render(ctx) {
      const filter = filteredNoise(ctx, 2.8, 'bandpass', 300, 1.1, [
        [2.5, 0.35],
        [2.75, 0.0001],
      ])
      filter.frequency.setValueAtTime(300, 0)
      filter.frequency.exponentialRampToValueAtTime(6000, 2.6)
      const osc = tone(ctx, 'sine', 220, 0, [
        [2.5, 0.18],
        [2.75, 0.0001],
      ])
      osc.frequency.setValueAtTime(220, 0)
      osc.frequency.exponentialRampToValueAtTime(880, 2.6)
    },
  },
  shimmer: {
    seconds: 3,
    render(ctx) {
      ;[1046.5, 1318.51, 1567.98, 2093].forEach((hz, i) => {
        tone(ctx, 'sine', hz * (1 + (i - 1.5) * 0.0015), i * 0.07, [
          [0.25, 0.12],
          [2.8, 0.0001],
        ])
      })
    },
  },
}

for (const sound of BUILTIN_SOUNDS) SYNTH[`app-${sound.id}`] = recipe(sound.recipe)

/** 16-bit stereo WAV, base64, so it crosses page.evaluate as a string. */
function wav(buffer: AudioBuffer): string {
  const frames = buffer.length
  const bytes = new DataView(new ArrayBuffer(44 + frames * 4))
  const text = (offset: number, value: string) =>
    [...value].forEach((c, i) => bytes.setUint8(offset + i, c.charCodeAt(0)))
  text(0, 'RIFF')
  bytes.setUint32(4, 36 + frames * 4, true)
  text(8, 'WAVEfmt ')
  bytes.setUint32(16, 16, true)
  bytes.setUint16(20, 1, true)
  bytes.setUint16(22, 2, true)
  bytes.setUint32(24, RATE, true)
  bytes.setUint32(28, RATE * 4, true)
  bytes.setUint16(32, 4, true)
  bytes.setUint16(34, 16, true)
  text(36, 'data')
  bytes.setUint32(40, frames * 4, true)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(Math.max(-1, Math.min(1, channel[i]!)) * 32767)
    bytes.setInt16(44 + i * 4, sample, true)
    bytes.setInt16(46 + i * 4, sample, true)
  }
  let binary = ''
  const raw = new Uint8Array(bytes.buffer)
  for (let i = 0; i < raw.length; i += 0x8000) binary += String.fromCharCode(...raw.subarray(i, i + 0x8000))
  return btoa(binary)
}

async function render(name: string): Promise<string> {
  const sound = SYNTH[name]
  if (!sound) throw new Error(`No built-in sound called "${name}"`)
  const ctx = new OfflineAudioContext(1, Math.ceil(sound.seconds * RATE), RATE)
  sound.render(ctx)
  return wav(await ctx.startRendering())
}

declare global {
  interface Window {
    __renderSound: typeof render
    __soundNames: string[]
  }
}

window.__renderSound = render
window.__soundNames = Object.keys(SYNTH)
