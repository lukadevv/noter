import { spawn } from 'node:child_process'
import { overlayScript } from './overlay.mjs'

/**
 * Frame-by-frame capture on virtual time.
 *
 * Nothing in the page moves on its own. Between two frames the recorder:
 *  1. advances Playwright's fake clock by exactly one frame, which drives
 *     Date, timers and requestAnimationFrame (Svelte, the app's countdowns);
 *  2. advances every Web Animation (CSS transitions and animations, Svelte's
 *     element.animate) by the same amount, with the document timeline itself
 *     frozen through the DevTools protocol;
 *  3. takes a screenshot and pipes it to ffmpeg.
 *
 * So a frame takes as long as it takes to render and the video still plays
 * back at a perfect 60 fps, with every run producing the same frames.
 *
 * Interactions go through `page.mouse` and `page.keyboard` with coordinates
 * read up front, never through locator actions: those wait for the page to
 * settle, and a page whose clock is paused never settles.
 */
export class Recorder {
  /**
   * @param {{ page: import('@playwright/test').Page, fps: number, ffmpeg: string, lead: number, scale?: number, seed?: number }} options
   * `lead` is the still pre-roll every scene starts with, which the editor
   * uses as the incoming half of a transition.
   */
  constructor({ page, fps, ffmpeg, lead, scale = 1, seed = 1 }) {
    this.page = page
    this.scale = scale
    this.fps = fps
    this.lead = lead
    this.ffmpeg = ffmpeg
    this.frameIndex = 0
    this.cues = []
    this.marks = {}
    this.cursor = { x: 0, y: 0 }
    this.random = mulberry32(seed)
  }

  /** Freezes the page's animations and installs the cursor and caption overlay. */
  async attach() {
    this.cdp = await this.page.context().newCDPSession(this.page)
    await this.cdp.send('Animation.enable')
    await this.#freeze()
    await this.page.addInitScript(overlayScript)
    await this.page.evaluate(overlayScript)
  }

  /** The timeline is frozen per document; a full navigation needs it again. */
  async #freeze() {
    const url = this.page.url().split('#')[0]
    if (url === this.frozenUrl) return
    await this.cdp.send('Animation.setPlaybackRate', { playbackRate: 0 })
    this.frozenUrl = url
  }

  /** Starts encoding a new scene file. Frame and cue times restart at zero. */
  begin(file) {
    this.file = file
    this.frameIndex = 0
    this.cues = []
    this.marks = {}
    this.encoder = spawn(
      this.ffmpeg,
      [
        '-y',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-c:v',
        'mjpeg',
        '-framerate',
        String(this.fps),
        '-i',
        '-',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '12',
        '-pix_fmt',
        'yuv420p',
        file,
      ],
      { stdio: ['pipe', 'inherit', 'inherit'] },
    )
    this.encoderDone = new Promise((resolve, reject) => {
      this.encoder.on('error', reject)
      this.encoder.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code} on ${file}`)),
      )
    })
  }

  /** Finishes the scene; returns its length, cues and marks in seconds. */
  async end() {
    this.encoder.stdin.end()
    await this.encoderDone
    return { file: this.file, duration: this.time, lead: this.lead, cues: this.cues, marks: this.marks }
  }

  /** Seconds since the scene began. */
  get time() {
    return this.frameIndex / this.fps
  }

  /**
   * Records a sound effect: now, `at` seconds from now, or `fromEnd` seconds
   * before wherever the editor ends up cutting this scene.
   */
  cue(name, gain = 1, { at = 0, fromEnd } = {}) {
    if (fromEnd !== undefined) this.cues.push({ name, fromEnd, gain })
    else this.cues.push({ name, time: this.time + at, gain })
  }

  /** Names the current moment, e.g. where the scene's content is complete. */
  mark(name) {
    this.marks[name] = this.time
  }

  // --- Time -------------------------------------------------------------------

  async frame() {
    const before = Math.round((this.frameIndex * 1000) / this.fps)
    const after = Math.round(((this.frameIndex + 1) * 1000) / this.fps)
    const step = after - before
    await this.#freeze()
    await this.page.clock.runFor(step)
    await this.page.evaluate((ms) => window.__trailer.step(ms), step)
    // Without an explicit clip the capture comes back in CSS pixels, ignoring
    // the device scale factor; the clip's scale renders at full resolution.
    const { data } = await this.cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 94,
      optimizeForSpeed: true,
      clip: { x: 0, y: 0, ...this.page.viewportSize(), scale: this.scale },
    })
    const buffer = Buffer.from(data, 'base64')
    if (!this.encoder.stdin.write(buffer))
      await new Promise((resolve) => this.encoder.stdin.once('drain', resolve))
    this.frameIndex++
  }

  /** Lets the page run untouched for a while. */
  async hold(seconds) {
    const frames = Math.round(seconds * this.fps)
    for (let i = 0; i < frames; i++) await this.frame()
  }

  /**
   * Waits for something that takes real time (a key derivation, a lazy
   * chunk) without filming the wait: time is nudged forward off camera, one
   * frame's worth at a time, until the element shows.
   */
  async until(locator, seconds = 30) {
    const step = Math.round(1000 / this.fps)
    const deadline = Date.now() + seconds * 1000
    while (!(await locator.first().isVisible())) {
      if (Date.now() > deadline) {
        await this.page.screenshot({
          path: new URL('../.cache/failure.png', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'),
        })
        throw new Error(`timed out waiting for ${locator} (screenshot: .trailer/.cache/failure.png)`)
      }
      await this.page.clock.runFor(step)
      await this.page.evaluate((ms) => window.__trailer.step(ms), step)
      await this.page.waitForTimeout(15)
    }
  }

  /** Holds until the scene is `seconds` long; does nothing if it already is. */
  async holdUntil(seconds) {
    while (this.time < seconds) await this.frame()
  }

  // --- Pointer -----------------------------------------------------------------

  /** Centre of an element (or a point inside it, as fractions of its box). */
  async pointOf(locator, { fx = 0.5, fy = 0.5 } = {}) {
    await locator.waitFor({ state: 'visible' })
    const box = await locator.boundingBox()
    if (!box) throw new Error(`no box for ${locator}`)
    return { x: box.x + box.width * fx, y: box.y + box.height * fy }
  }

  /** Puts the cursor somewhere without animating it, e.g. at the start of a scene. */
  async placeCursor(x, y) {
    this.cursor = { x, y }
    await this.page.mouse.move(x, y)
    await this.page.evaluate(([cx, cy]) => window.__trailer.cursor(cx, cy), [x, y])
  }

  /** Glides the cursor to a target on an eased curve, the way a hand moves. */
  async moveTo(target, { seconds } = {}) {
    const to = 'x' in target ? target : await this.pointOf(target)
    const from = { ...this.cursor }
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const duration = seconds ?? Math.min(0.9, 0.28 + distance / 2200)
    const frames = Math.max(1, Math.round(duration * this.fps))
    // A slight arc instead of a ruler-straight line.
    const bend = (this.random() - 0.5) * 0.18 * distance
    const nx = -(to.y - from.y) / (distance || 1)
    const ny = (to.x - from.x) / (distance || 1)
    for (let i = 1; i <= frames; i++) {
      const t = easeInOutCubic(i / frames)
      const arc = Math.sin(Math.PI * t) * bend
      const x = from.x + (to.x - from.x) * t + nx * arc
      const y = from.y + (to.y - from.y) * t + ny * arc
      await this.page.mouse.move(x, y)
      await this.page.evaluate(([cx, cy]) => window.__trailer.cursor(cx, cy), [x, y])
      this.cursor = { x, y }
      await this.frame()
    }
  }

  /** Moves to the target and clicks it, with a press animation and a click cue. */
  async click(target, { sound = 'click', gain = 1, settle = 0.25, button = 'left' } = {}) {
    await this.moveTo(target)
    await this.hold(0.08)
    await this.page.evaluate(() => window.__trailer.press())
    if (sound) this.cue(sound, gain)
    await this.page.mouse.down({ button })
    await this.frame()
    await this.frame()
    await this.page.mouse.up({ button })
    await this.hold(settle)
  }

  /** Scrolls the element under the cursor smoothly by `dy` pixels. */
  async scroll(dy, seconds = 0.8) {
    const frames = Math.round(seconds * this.fps)
    let done = 0
    for (let i = 1; i <= frames; i++) {
      const target = Math.round(dy * easeInOutCubic(i / frames))
      await this.page.mouse.wheel(0, target - done)
      done = target
      await this.frame()
    }
  }

  // --- Keyboard ------------------------------------------------------------------

  /**
   * Types like a person: about `cps` characters a second, with an uneven
   * rhythm, a short pause after spaces and punctuation, and a soft key sound.
   */
  async type(text, { cps = 14, sound = 'key', gain = 0.35 } = {}) {
    for (const char of text) {
      await this.page.keyboard.type(char)
      if (sound && char.trim()) this.cue(sound, gain * (0.75 + this.random() * 0.5))
      let delay = (1 / cps) * (0.6 + this.random() * 0.8)
      if (char === ' ') delay *= 1.4
      if (/[.,:;!?]/.test(char)) delay *= 2.2
      await this.hold(delay)
    }
  }

  async press(key, { sound = 'key', gain = 0.35, settle = 0.12 } = {}) {
    await this.page.keyboard.press(key)
    if (sound) this.cue(sound, gain)
    await this.hold(settle)
  }

  /**
   * Off camera: clears the caption and lets every running animation and
   * timer finish, so a scene does not open on the tail of the previous one.
   */
  async settle(ms = 6000) {
    await this.caption('')
    await this.page.clock.runFor(ms)
    await this.page.evaluate((value) => window.__trailer.step(value), ms)
  }

  // --- Overlay --------------------------------------------------------------------

  async caption(text) {
    await this.page.evaluate((value) => window.__trailer.caption(value), text)
  }

  async showCursor(visible) {
    await this.page.evaluate((value) => window.__trailer.cursorVisible(value), visible)
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Small seeded PRNG, so typing rhythm and cursor arcs are the same every run. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
