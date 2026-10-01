#!/usr/bin/env node
/**
 * Renders the Noter trailer, once per language.
 *
 *   pnpm trailer                 every language in config.mjs
 *   pnpm trailer --lang es       one language (or a list: es,en; or "all")
 *   pnpm trailer --draft         720p at 30 fps, for checking the cut quickly
 *   pnpm trailer --check         only report what is missing, render nothing
 *   pnpm trailer --keep          keep the per-scene recordings in .trailer/.cache
 *   pnpm trailer --reuse         edit and mix the recordings kept by --keep, without
 *                                recording again (for tuning the cut, grade and sound)
 *
 * See .trailer/README.md.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import config from './config.mjs'
import { scenes } from './scenes.mjs'
import { Recorder } from './lib/recorder.mjs'
import { detectBeats, gridBeats } from './lib/beats.mjs'
import { duration, findTool } from './lib/ffmpeg.mjs'
import {
  placeCues,
  planCuts,
  renderEffects,
  renderFinal,
  renderPoster,
  renderVideo,
  renderWeb,
} from './lib/edit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const AUDIO = join(HERE, 'assets')
const SFX = join(AUDIO, 'sfx')
const CACHE = join(HERE, '.cache')
const OUT = join(HERE, 'out')
const AUDIO_EXTENSIONS = ['wav', 'mp3', 'ogg', 'flac', 'm4a']

const yellow = (text) => (process.stdout.isTTY ? `\x1b[33m${text}\x1b[0m` : text)
const red = (text) => (process.stdout.isTTY ? `\x1b[31m${text}\x1b[0m` : text)
const dim = (text) => (process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text)

const warnings = []
function warn(message) {
  warnings.push(message)
  console.warn(yellow(`! ${message}`))
}
function fail(message) {
  console.error(red(`✖ ${message}`))
  process.exit(1)
}
function step(message) {
  console.log(`› ${message}`)
}

const { values: args } = parseArgs({
  options: {
    lang: { type: 'string' },
    draft: { type: 'boolean', default: false },
    check: { type: 'boolean', default: false },
    keep: { type: 'boolean', default: false },
    reuse: { type: 'boolean', default: false },
  },
})

// --- Preflight -------------------------------------------------------------------

const appLocales = readdirSync(join(ROOT, 'src/lib/i18n/locales')).map((file) => file.replace(/\.ts$/, ''))
const copyLocales = readdirSync(join(HERE, 'copy')).map((file) => file.replace(/\.mjs$/, ''))

const languages = !args.lang
  ? config.languages
  : args.lang === 'all'
    ? copyLocales
    : args.lang.split(',').map((l) => l.trim())
for (const lang of languages) {
  if (!appLocales.includes(lang))
    fail(`"${lang}" is not a language the app ships (${appLocales.join(', ')}).`)
  if (!copyLocales.includes(lang)) {
    fail(
      `No trailer text for "${lang}". Copy .trailer/copy/es.mjs to .trailer/copy/${lang}.mjs and translate it.`,
    )
  }
}

const ffmpeg = findTool('ffmpeg')
const ffprobe = findTool('ffprobe')
if (!ffmpeg || !ffprobe) {
  fail(
    'ffmpeg was not found. Install it (Windows: `winget install ffmpeg`, then open a new terminal) ' +
      'or point FFMPEG_PATH and FFPROBE_PATH at the binaries.',
  )
}

const { chromium } = await import('@playwright/test')
if (!existsSync(chromium.executablePath())) {
  fail('Playwright has no Chromium yet. Run `pnpm exec playwright install chromium` once.')
}

function findAudio(dir, name) {
  for (const ext of AUDIO_EXTENSIONS) {
    const file = join(dir, `${name}.${ext}`)
    if (existsSync(file)) return file
  }
  return null
}

const musicFile = config.music.file
  ? join(AUDIO, config.music.file)
  : config.music.candidates.map((name) => join(AUDIO, name)).find((file) => existsSync(file))
if (config.music.file && !existsSync(musicFile)) {
  warn(
    `config.music.file is "${config.music.file}" but .trailer/assets/${config.music.file} does not exist.`,
  )
}
const music = musicFile && existsSync(musicFile) ? musicFile : null
if (!music) {
  warn(
    'No music: put the track in .trailer/assets/music.mp3 (or .wav). The trailer is rendered with effects ' +
      `only, cut to a ${config.music.fallbackBpm} BPM grid.`,
  )
} else {
  const credits = join(AUDIO, 'CREDITS.md')
  const name = relative(AUDIO, music)
  // Listed with a link to where it came from, not just named in the template row.
  const listed =
    existsSync(credits) &&
    readFileSync(credits, 'utf8')
      .split('\n')
      .some((line) => line.includes(name) && line.includes('http'))
  if (!listed)
    warn(`.trailer/assets/CREDITS.md has no source URL for ${name}. Note its source and licence there.`)
}

const sounds = {}
const synthesised = []
for (const name of config.effects) {
  const file = findAudio(SFX, name)
  if (file) sounds[name] = file
  else synthesised.push(name)
}
if (synthesised.length) {
  warn(
    `No file for ${synthesised.map((n) => `"${n}"`).join(', ')} in .trailer/assets/sfx/; ` +
      'using synthesised stand-ins. See .trailer/README.md for where to get CC0 sounds.',
  )
}

if (args.check) {
  console.log(
    warnings.length
      ? `\n${warnings.length} warning(s). Nothing rendered (--check).`
      : 'All assets present.',
  )
  process.exit(0)
}

// --- Setup ------------------------------------------------------------------------

const fps = args.draft ? 30 : config.video.fps
const width = args.draft ? 1280 : config.video.width
const height = args.draft ? 720 : config.video.height
const deviceScaleFactor = (config.video.scale * width) / config.video.width
// Cards are designed for a 1536x864 screen; the app scenes use `video.scale`.
const CARD_SCALE = 1.25
const cardScale = (CARD_SCALE * width) / config.video.width
const cardViewport = {
  width: Math.round(width / cardScale),
  height: Math.round(height / cardScale),
}
const viewport = {
  width: Math.round(width / deviceScaleFactor),
  height: Math.round(height / deviceScaleFactor),
}

mkdirSync(join(CACHE, 'sfx'), { recursive: true })
mkdirSync(join(CACHE, 'scenes'), { recursive: true })
mkdirSync(OUT, { recursive: true })

step('Starting the app (Vite dev server)')
const { createServer } = await import('vite')
const server = await createServer({
  root: ROOT,
  configFile: join(ROOT, 'vite.config.ts'),
  logLevel: 'error',
  server: { port: 5190, strictPort: false, hmr: false },
})
await server.listen()
const base = server.resolvedUrls.local[0]

const browser = await chromium.launch()
const failures = []

try {
  // App alarm recipes, plus stand-ins for missing effect files.
  {
    const page = await browser.newPage()
    await page.goto(`${base}.trailer/app/card.html`)
    await page.evaluate(() => import('/.trailer/app/sounds.ts'))
    const appSounds = await page.evaluate(() =>
      window.__soundNames.filter((name) => name.startsWith('app-')),
    )
    const needed = [...synthesised, ...appSounds]
    for (const name of needed) {
      const file = join(CACHE, 'sfx', `${name}.wav`)
      const data = await page.evaluate((n) => window.__renderSound(n), name)
      writeFileSync(file, Buffer.from(data, 'base64'))
      sounds[name] = file
    }
    await page.close()
  }

  // The beat grid every cut snaps to.
  let beats
  if (config.music.bpm && config.music.firstBeat !== null) {
    beats = gridBeats({ bpm: config.music.bpm, firstBeat: config.music.firstBeat })
    step(`Beat grid from config: ${config.music.bpm} BPM`)
  } else if (music) {
    step('Finding the beat')
    beats = await detectBeats(ffmpeg, music, { start: config.music.start, prefer: config.music.expectBpm })
    step(`${beats.bpm.toFixed(1)} BPM, first beat at ${beats.beats[0]?.toFixed(3)}s`)
    if (beats.bpm < 80 || beats.bpm > 140)
      warn(`Detected ${beats.bpm.toFixed(1)} BPM; if that is wrong, set music.bpm in config.mjs.`)
  } else {
    beats = gridBeats({ bpm: config.music.fallbackBpm })
  }

  for (const lang of languages) {
    try {
      await renderLanguage(lang, beats)
    } catch (error) {
      failures.push(lang)
      console.error(red(`✖ ${lang}: ${error.stack ?? error}`))
    }
  }
} finally {
  await browser.close()
  await server.close()
}

if (warnings.length) {
  console.log(yellow(`\n${warnings.length} warning(s):`))
  for (const message of warnings) console.log(yellow(`  - ${message}`))
}
if (failures.length) fail(`Failed: ${failures.join(', ')}`)

/** Seeds the demo data, drives every scene and returns what was recorded. */
async function recordScenes(lang, copy, recordsFile) {
  step(`[${lang}] Seeding the demo data`)

  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    locale: copy.browserLocale,
    timezoneId: config.clock.timezone,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  })
  await context.clock.install({ time: new Date(config.clock.time) })
  await context.addInitScript((locale) => localStorage.setItem('noter.locale', locale), lang)

  const app = await context.newPage()
  await app.goto(`${base}.trailer/app/seed.html`)
  await app.waitForFunction(() => typeof window.__seed === 'function')
  await app.evaluate((demo) => window.__seed(demo), copy.demo)

  // Boot the app once, with the clock still running, then stop time.
  await app.goto(`${base}#/home`)
  await app.waitForSelector('[data-testid="app-shell"]')
  await app.waitForSelector('[data-testid="home-today"]')
  await app.waitForTimeout(1500)
  await context.clock.pauseAt(new Date(new Date(config.clock.time).getTime() + 60_000))

  // The title cards are laid out for a wider, less zoomed screen than the app
  // scenes, so they get their own context with the matching scale.
  const cardContext = await browser.newContext({
    viewport: cardViewport,
    deviceScaleFactor: cardScale,
    locale: copy.browserLocale,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  })
  await cardContext.clock.install({ time: new Date(config.clock.time) })
  await cardContext.clock.pauseAt(new Date(new Date(config.clock.time).getTime() + 60_000))
  const cards = await cardContext.newPage()
  await cards.goto(`${base}.trailer/app/card.html`)
  await cards.waitForFunction(() => typeof window.__card === 'function')
  await cards.evaluate(() => document.fonts.ready)

  const recorders = {
    app: new Recorder({
      page: app,
      fps,
      ffmpeg,
      lead: config.video.lead,
      scale: deviceScaleFactor,
      camera: config.video.camera,
      seed: 7,
    }),
    card: new Recorder({
      page: cards,
      fps,
      ffmpeg,
      lead: config.video.lead,
      scale: cardScale,
      camera: false,
      seed: 11,
    }),
  }
  await recorders.app.attach()
  await recorders.card.attach()
  await recorders.card.showCursor(false)

  const records = []
  for (const scene of scenes) {
    const kind = scene.kind === 'card' ? 'card' : 'app'
    const rec = recorders[kind]
    const page = rec.page
    await page.bringToFront()
    if (scene.prepare) await scene.prepare({ page, base, copy })
    await rec.settle()
    rec.begin(join(CACHE, 'scenes', `${lang}-${scene.id}.mp4`))
    await scene.play({ rec, page, base, copy })
    if (rec.marks.done === undefined) rec.mark('done')
    // Tail, so the cut can move to a later beat.
    await rec.hold(scene.last ? 1.5 : 2.5)
    records.push(await rec.end())
    step(`[${lang}] ${scene.id}: ${records.at(-1).duration.toFixed(1)}s recorded`)
  }
  await context.close()
  await cardContext.close()
  writeFileSync(recordsFile, JSON.stringify(records))
  return records
}

// --- One language ------------------------------------------------------------------

async function renderLanguage(lang, beats) {
  const { default: copy } = await import(pathToFileURL(join(HERE, 'copy', `${lang}.mjs`)).href)
  const started = Date.now()
  const recordsFile = join(CACHE, 'scenes', `${lang}-records.json`)
  let records
  if (args.reuse && existsSync(recordsFile)) {
    step(`[${lang}] Reusing the kept recordings`)
    records = JSON.parse(readFileSync(recordsFile, 'utf8'))
  } else {
    records = await recordScenes(lang, copy, recordsFile)
  }

  // Edit.
  const transition = config.video.transition
  const cuts = planCuts(scenes, records, beats, { transition, warn: (m) => warn(`[${lang}] ${m}`) })
  const cues = placeCues(scenes, records, cuts, { transition })
  const total = cuts.at(-1)
  const dir = join(OUT, lang)
  mkdirSync(dir, { recursive: true })
  const suffix = args.draft ? '-draft' : ''
  const silent = join(CACHE, `${lang}-video.mp4`)
  const effects = join(CACHE, `${lang}-effects.wav`)
  const final = join(dir, `noter-trailer-${lang}${suffix}.mp4`)

  step(`[${lang}] Editing ${total.toFixed(1)}s`)
  await renderVideo(ffmpeg, scenes, records, cuts, { transition, fps, file: silent })
  await renderEffects(ffmpeg, cues, sounds, { seconds: total, file: effects })
  const outroIndex = scenes.findIndex((scene) => scene.last)
  await renderFinal(ffmpeg, {
    video: silent,
    effects,
    music: music ? { file: music, start: config.music.start } : null,
    seconds: total,
    musicStop: cuts[outroIndex],
    audio: config.audio,
    file: final,
  })

  const outputs = [final]
  if (!args.draft) {
    const web = join(dir, `noter-trailer-${lang}-web.mp4`)
    await renderWeb(ffmpeg, { input: final, file: web })
    const poster = join(dir, `noter-trailer-${lang}-poster.png`)
    const posterTime = cuts[outroIndex] + (records[outroIndex].marks.poster - records[outroIndex].lead)
    await renderPoster(ffmpeg, { input: final, time: Math.min(posterTime, total - 0.9), file: poster })
    outputs.push(web, poster)
  }

  writeFileSync(
    join(dir, `timeline${suffix}.json`),
    JSON.stringify(
      {
        lang,
        fps,
        bpm: Number(beats.bpm.toFixed(2)),
        music: music ? relative(HERE, music) : null,
        scenes: scenes.map((scene, i) => ({ id: scene.id, from: cuts[i], to: cuts[i + 1] })),
        cues,
      },
      null,
      2,
    ),
  )

  if (!args.keep) {
    for (const record of records) rmSync(record.file, { force: true })
    rmSync(silent, { force: true })
    rmSync(effects, { force: true })
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(0)
  const length = (await duration(ffprobe, final)).toFixed(1)
  console.log(`✔ [${lang}] ${length}s trailer in ${seconds}s`)
  for (const file of outputs) console.log(dim(`    ${relative(ROOT, file)}`))
}
