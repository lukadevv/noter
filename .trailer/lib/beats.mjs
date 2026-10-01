import { decode } from './ffmpeg.mjs'

/**
 * Tempo and beat grid of the music, so cuts land on the beat.
 *
 * Plain JavaScript instead of aubio or librosa, so `pnpm trailer` needs
 * nothing but ffmpeg on Windows. The method is the classic one, and enough
 * for the steady electronic or lo-fi tracks a trailer uses:
 *  1. an onset envelope from spectral flux (how much the spectrum grows from
 *     one short window to the next - drums and note starts stand out);
 *  2. the tempo from its autocorrelation, weighted towards the expected range;
 *  3. the phase by sliding a grid of that tempo over the envelope;
 *  4. the downbeat by checking which of the four beats is the loudest.
 *
 * It assumes a constant tempo. If a track defeats it, set `music.bpm` and
 * `music.firstBeat` in config.mjs and detection is skipped.
 */

const RATE = 22_050
const WINDOW = 1024
const HOP = 256

export async function detectBeats(ffmpeg, file, { start = 0, seconds = 120, prefer = 105 } = {}) {
  const samples = await decode(ffmpeg, file, { rate: RATE, channels: 1, start, seconds })
  const envelope = onsetEnvelope(samples)
  const fps = RATE / HOP

  const period = estimatePeriod(envelope, fps, prefer)
  const phase = estimatePhase(envelope, period)
  const beats = []
  // A frame is stamped with the start of its window, but an onset only shows
  // once it is well inside it: shift by one window to line up with the hit.
  const latency = WINDOW / RATE
  for (let frame = phase; frame < envelope.length; frame += period) beats.push(frame / fps + latency)

  const downbeat = estimateDownbeat(envelope, beats, fps, latency)
  return { bpm: (60 * fps) / period, beats, downbeat }
}

/** A regular grid, for a known tempo or when there is no music at all. */
export function gridBeats({ bpm, firstBeat = 0, seconds = 120 }) {
  const beats = []
  for (let t = firstBeat; t < seconds; t += 60 / bpm) beats.push(t)
  return { bpm, beats, downbeat: 0 }
}

function onsetEnvelope(samples) {
  const frames = Math.max(0, Math.floor((samples.length - WINDOW) / HOP))
  const hann = Float32Array.from(
    { length: WINDOW },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / WINDOW),
  )
  const re = new Float64Array(WINDOW)
  const im = new Float64Array(WINDOW)
  let previous = new Float64Array(WINDOW / 2)
  const flux = new Float64Array(frames)

  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < WINDOW; i++) {
      re[i] = samples[f * HOP + i] * hann[i]
      im[i] = 0
    }
    fft(re, im)
    const current = new Float64Array(WINDOW / 2)
    let sum = 0
    for (let k = 1; k < WINDOW / 2; k++) {
      current[k] = Math.log1p(100 * Math.hypot(re[k], im[k]))
      sum += Math.max(0, current[k] - previous[k])
    }
    flux[f] = sum
    previous = current
  }

  // Remove the slowly moving average and keep only the rises.
  const out = new Float64Array(frames)
  const radius = 16
  for (let f = 0; f < frames; f++) {
    let mean = 0
    let count = 0
    for (let j = Math.max(0, f - radius); j <= Math.min(frames - 1, f + radius); j++) {
      mean += flux[j]
      count++
    }
    out[f] = Math.max(0, flux[f] - mean / count)
  }
  return out
}

function estimatePeriod(envelope, fps, prefer) {
  const minLag = Math.floor((60 * fps) / 190)
  const maxLag = Math.ceil((60 * fps) / 55)
  const scores = new Float64Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag + 1; lag++) {
    let sum = 0
    for (let i = lag; i < envelope.length; i++) sum += envelope[i] * envelope[i - lag]
    // A log-normal preference around the expected tempo resolves the usual
    // half/double ambiguity in favour of the range the track was chosen for.
    const bpm = (60 * fps) / lag
    const weight = Math.exp(-0.5 * (Math.log2(bpm / prefer) / 0.6) ** 2)
    scores[lag] = (sum / (envelope.length - lag)) * weight
  }
  let best = minLag
  for (let lag = minLag; lag <= maxLag; lag++) if (scores[lag] > scores[best]) best = lag
  // Parabolic interpolation for a sub-frame period.
  const a = scores[best - 1] ?? 0
  const b = scores[best]
  const c = scores[best + 1] ?? 0
  const shift = a - 2 * b + c === 0 ? 0 : (0.5 * (a - c)) / (a - 2 * b + c)
  return best + Math.max(-0.5, Math.min(0.5, shift))
}

function estimatePhase(envelope, period) {
  let best = 0
  let bestScore = -1
  for (let phase = 0; phase < period; phase += 0.25) {
    let score = 0
    for (let frame = phase; frame < envelope.length; frame += period) {
      const i = Math.round(frame)
      // A little tolerance either side.
      score += Math.max(envelope[i] ?? 0, 0.5 * (envelope[i - 1] ?? 0), 0.5 * (envelope[i + 1] ?? 0))
    }
    if (score > bestScore) {
      bestScore = score
      best = phase
    }
  }
  return best
}

function estimateDownbeat(envelope, beats, fps, latency) {
  const sums = [0, 0, 0, 0]
  beats.forEach((time, index) => (sums[index % 4] += envelope[Math.round((time - latency) * fps)] ?? 0))
  return sums.indexOf(Math.max(...sums))
}

/** In-place iterative radix-2 FFT. */
function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = (-2 * Math.PI) / size
    const wr = Math.cos(angle)
    const wi = Math.sin(angle)
    for (let start = 0; start < n; start += size) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < size / 2; k++) {
        const a = start + k
        const b = a + size / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const next = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = next
      }
    }
  }
}
