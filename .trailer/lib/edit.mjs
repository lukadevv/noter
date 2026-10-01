import { writeFileSync } from 'node:fs'
import { decode, run } from './ffmpeg.mjs'

/**
 * Turns recorded scenes into the cut: where each scene starts and ends on the
 * beat grid, the video with transitions, and the audio mix.
 *
 * Timeline model. `cuts[i]` is the moment scene i takes over from scene i-1,
 * and a transition of length `d` is centred on it. Scene i therefore shows from
 * `cuts[i] - d/2` to `cuts[i+1] + d/2`, and its own recording supplies that
 * from its `lead` pre-roll onwards: trailer time `cuts[i]` is recording time
 * `lead`.
 */

/** Chooses the cut times. */
export function planCuts(scenes, records, beats, { transition, warn }) {
  const half = transition / 2
  const period = beats.beats.length > 1 ? beats.beats[1] - beats.beats[0] : 0.5
  const cuts = [0]

  scenes.forEach((scene, i) => {
    const record = records[i]
    const start = cuts[i]
    const content = record.marks.done - record.lead
    const room = record.duration - record.lead - (scene.last ? 0 : half)
    const earliest = start + content
    const latest = start + room

    // Prefer the beat nearest the scripted time, a downbeat if one is close,
    // and never before the scene has shown everything it has to show.
    const want = Math.max(scene.target, earliest)
    let best = null
    let bestScore = Infinity
    beats.beats.forEach((time, index) => {
      if (time < earliest - 1e-6 || time > latest + 1e-6) return
      const downbeat = (index - beats.downbeat) % 4 === 0
      const score = Math.abs(time - want) + (downbeat ? 0 : period * 0.6)
      if (score < bestScore) {
        bestScore = score
        best = time
      }
    })
    if (best === null) {
      warn(
        `Scene "${scene.id}": no beat between ${earliest.toFixed(2)}s and ${latest.toFixed(2)}s; cutting off the beat.`,
      )
      best = Math.min(latest, want)
    }
    cuts.push(best)
  })
  return cuts
}

/** Where every cue lands on the trailer timeline. */
export function placeCues(scenes, records, cuts, { transition }) {
  const half = transition / 2
  const placed = []
  scenes.forEach((scene, i) => {
    const record = records[i]
    const from = i === 0 ? 0 : cuts[i] - half
    const to = cuts[i + 1] + (scene.last ? 0 : half)
    for (const cue of record.cues) {
      const time =
        cue.fromEnd !== undefined ? cuts[i + 1] - cue.fromEnd : cuts[i] + (cue.time - record.lead)
      if (time >= from - 1e-6 && time < to)
        placed.push({ name: cue.name, time, gain: cue.gain, scene: scene.id })
    }
    // A soft whoosh under every moving transition; fades stay quiet.
    if (i > 0 && scene.transition && !['fade', 'fadeblack'].includes(scene.transition)) {
      placed.push({ name: 'whoosh', time: cuts[i] - 0.35, gain: 0.4, scene: scene.id })
    }
  })
  return placed.sort((a, b) => a.time - b.time)
}

/** Joins the scenes with their transitions into one silent video. */
export async function renderVideo(ffmpeg, scenes, records, cuts, { transition, fps, file, fadeOut = 0.7 }) {
  const half = transition / 2
  const args = ['-y', '-v', 'error']
  for (const record of records) args.push('-i', record.file)

  const filters = []
  scenes.forEach((scene, i) => {
    const lead = records[i].lead
    const from = i === 0 ? lead : lead - half
    const to = lead + (cuts[i + 1] - cuts[i]) + (scene.last ? 0 : half)
    filters.push(
      `[${i}:v]trim=start=${from.toFixed(4)}:end=${to.toFixed(4)},setpts=PTS-STARTPTS,fps=${fps},format=yuv420p[s${i}]`,
    )
  })

  let previous = 's0'
  for (let i = 1; i < scenes.length; i++) {
    const kind = scenes[i].transition ?? 'fade'
    const offset = (cuts[i] - half).toFixed(4)
    const out = `x${i}`
    filters.push(
      `[${previous}][s${i}]xfade=transition=${kind}:duration=${transition}:offset=${offset}[${out}]`,
    )
    previous = out
  }
  const total = cuts[cuts.length - 1]
  // A light grade over the whole cut: a touch more contrast and colour, and a
  // soft vignette that settles the eye on the middle of the frame.
  filters.push(
    `[${previous}]eq=contrast=1.03:saturation=1.07,vignette=angle=PI/7,` +
      `fade=t=out:st=${(total - fadeOut).toFixed(4)}:d=${fadeOut}[v]`,
  )

  args.push('-filter_complex', filters.join(';'), '-map', '[v]')
  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '14',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    file,
  )
  await run(ffmpeg, args)
  return total
}

/**
 * Mixes every placed cue into one stereo track, in memory, and writes it as a
 * 32-bit float WAV. One input per cue would be hundreds of ffmpeg inputs (the
 * typing alone is dozens of key sounds); summing samples here is simpler.
 */
export async function renderEffects(ffmpeg, cues, sounds, { seconds, file }) {
  const rate = 48_000
  const bus = new Float32Array(Math.ceil(seconds * rate) * 2)
  const cache = new Map()
  for (const cue of cues) {
    const path = sounds[cue.name]
    if (!path) continue
    if (!cache.has(path)) cache.set(path, await decode(ffmpeg, path, { rate, channels: 2 }))
    const samples = cache.get(path)
    const offset = Math.round(cue.time * rate) * 2
    for (let i = 0; i < samples.length && offset + i < bus.length; i++) {
      if (offset + i >= 0) bus[offset + i] += samples[i] * cue.gain
    }
  }
  writeFileSync(file, floatWav(bus, rate))
}

function floatWav(samples, rate) {
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + samples.byteLength, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(3, 20) // IEEE float
  header.writeUInt16LE(2, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 8, 28)
  header.writeUInt16LE(8, 32)
  header.writeUInt16LE(32, 34)
  header.write('data', 36)
  header.writeUInt32LE(samples.byteLength, 40)
  return Buffer.concat([header, Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)])
}

/**
 * Final mix and export: the music ducks under the effects (sidechain), stops
 * just before the closing card for the half second of silence, and the whole
 * thing is normalised to streaming loudness.
 */
export async function renderFinal(ffmpeg, { video, effects, music, seconds, musicStop, audio, file }) {
  const args = ['-y', '-v', 'error', '-i', video, '-i', effects]
  const filters = []
  if (music) {
    args.push('-stream_loop', '-1', '-ss', String(music.start), '-i', music.file)
    const fadeStart = Math.max(0, musicStop - audio.musicFadeOut)
    filters.push(
      `[2:a]atrim=0:${seconds.toFixed(4)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,` +
        `volume=${audio.musicGain},afade=t=in:st=0:d=${audio.musicFadeIn},` +
        `afade=t=out:st=${fadeStart.toFixed(4)}:d=${audio.musicFadeOut}[music]`,
      `[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${audio.effectsGain},asplit=2[fx][key]`,
      `[music][key]sidechaincompress=threshold=${audio.duck.threshold}:ratio=${audio.duck.ratio}:` +
        `attack=${audio.duck.attack}:release=${audio.duck.release}[ducked]`,
      `[ducked][fx]amix=inputs=2:normalize=0:duration=first[mix]`,
    )
  } else {
    filters.push(`[1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${audio.effectsGain}[mix]`)
  }
  filters.push(
    `[mix]apad,atrim=0:${seconds.toFixed(4)},loudnorm=I=${audio.loudness}:TP=-1.5:LRA=11,` +
      `aresample=48000,afade=t=out:st=${(seconds - 0.4).toFixed(4)}:d=0.4[a]`,
  )
  args.push('-filter_complex', filters.join(';'), '-map', '0:v', '-map', '[a]')
  args.push(
    '-c:v',
    'copy',
    '-c:a',
    'aac',
    '-b:a',
    '320k',
    '-ar',
    '48000',
    '-movflags',
    '+faststart',
    '-shortest',
    file,
  )
  await run(ffmpeg, args)
}

/** A lighter copy for the README and GitHub releases (GitHub caps uploads at 10 MB). */
export async function renderWeb(ffmpeg, { input, file }) {
  await run(ffmpeg, [
    '-y',
    '-v',
    'error',
    '-i',
    input,
    '-vf',
    'scale=1280:-2:flags=lanczos,fps=30',
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '27',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-movflags',
    '+faststart',
    file,
  ])
}

/** One still frame, e.g. the Store trailer thumbnail. */
export async function renderPoster(ffmpeg, { input, time, file }) {
  await run(ffmpeg, ['-y', '-v', 'error', '-ss', time.toFixed(3), '-i', input, '-frames:v', '1', file])
}
