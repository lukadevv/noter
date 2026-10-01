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
 *
 * The camera never touches the page. It is the capture itself: each frame
 * screenshots a smaller rectangle of the page at a higher scale, so Chrome
 * renders the close-up at full resolution (text stays sharp, unlike zooming
 * the video afterwards) while the app's layout, its menus and every click
 * coordinate stay exactly as they are. The caption is counter-scaled to the
 * same rectangle, so it keeps its size and place on screen.
 */
export class Recorder {
  /**
   * @param {{ page: import('@playwright/test').Page, fps: number, ffmpeg: string, lead: number, scale?: number, seed?: number }} options
   * `lead` is the still pre-roll every scene starts with, which the editor
   * uses as the incoming half of a transition.
   */
  constructor({ page, fps, ffmpeg, lead, scale = 1, camera = true, seed = 1 }) {
    this.page = page
    this.cameraEnabled = camera
    this.scale = scale
    this.fps = fps
    this.lead = lead
    this.ffmpeg = ffmpeg
    this.frameIndex = 0
    this.cues = []
    this.marks = {}
    /** Cursor position, in page coordinates. */
    this.cursor = { x: 0, y: 0 }
    /** Where the camera looks (page coordinates) and how close. */
    this.view = { x: 0, y: 0, zoom: 1 }
    this.tween = null
    /** Slow extra push after a move has landed, so a held shot never goes dead. */
    this.drift = null
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
        // A close-up's capture can come out a pixel short from rounding; every
        // frame is brought back to the exact output size.
        '-vf',
        `scale=${this.outputSize.width}:${this.outputSize.height}:flags=lanczos`,
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
    // If ffmpeg dies, writing to it fails with EPIPE; the exit code below is
    // the useful part, so the pipe error is not allowed to crash the run.
    this.encoder.stdin.on('error', () => {})
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

  /** A point at a fraction of the viewport, so scenes do not depend on its size. */
  at(fx, fy) {
    const { width, height } = this.page.viewportSize()
    return { x: Math.round(width * fx), y: Math.round(height * fy) }
  }

  /** Pixel size of every frame: the viewport at the device scale factor. */
  get outputSize() {
    const { width, height } = this.page.viewportSize()
    return { width: Math.round(width * this.scale), height: Math.round(height * this.scale) }
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
    this.#advanceCamera()
    const clip = this.#clip()
    await this.page.evaluate(
      ([ms, c, x, y]) => {
        window.__trailer.frameTo(c.x, c.y, c.zoom)
        window.__trailer.cursor(x, y)
        window.__trailer.step(ms)
      },
      [step, clip, this.cursor.x, this.cursor.y],
    )
    // The clip is also what makes the output full resolution: without one the
    // capture comes back in CSS pixels, ignoring the device scale factor.
    const { data } = await this.cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 94,
      optimizeForSpeed: true,
      clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: this.scale * clip.zoom },
    })
    if (this.encoder.exitCode !== null) await this.encoderDone
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

  /**
   * A point on an element (as fractions of its box). Waits with `until`, not
   * `locator.waitFor`: Playwright polls on animation frames, which a paused
   * clock never delivers, so a wait that does not succeed at once never ends.
   */
  async pointOf(locator, { fx = 0.5, fy = 0.5 } = {}) {
    await this.until(locator, 10)
    const box = await locator.first().boundingBox()
    if (!box) throw new Error(`no box for ${locator}`)
    return { x: box.x + box.width * fx, y: box.y + box.height * fy }
  }

  /** Puts the cursor somewhere without animating it, e.g. at the start of a scene. */
  async placeCursor(x, y) {
    if (typeof x === 'object') ({ x, y } = x)
    this.cursor = { x, y }
    await this.page.mouse.move(x, y)
    await this.page.evaluate(([cx, cy]) => window.__trailer.cursor(cx, cy), [x, y])
  }

  /** Glides the cursor to a target on an eased curve, the way a hand moves. */
  async moveTo(target, { seconds } = {}) {
    const to = 'x' in target ? target : await this.pointOf(target)
    const from = { ...this.cursor }
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    // Timed by how far it travels on screen, which is further when zoomed in.
    const duration = seconds ?? Math.min(0.9, 0.28 + (distance * this.view.zoom) / 2200)
    const frames = Math.max(1, Math.round(duration * this.fps))
    // A slight arc instead of a ruler-straight line.
    const bend = (this.random() - 0.5) * 0.18 * distance
    const nx = -(to.y - from.y) / (distance || 1)
    const ny = (to.x - from.x) / (distance || 1)
    for (let i = 1; i <= frames; i++) {
      const t = easeInOutCubic(i / frames)
      const arc = Math.sin(Math.PI * t) * bend
      this.cursor = {
        x: from.x + (to.x - from.x) * t + nx * arc,
        y: from.y + (to.y - from.y) * t + ny * arc,
      }
      await this.page.mouse.move(this.cursor.x, this.cursor.y)
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
    this.tween = null
    this.view = { x: 0, y: 0, zoom: 1 }
    await this.page.clock.runFor(ms)
    await this.page.evaluate((value) => window.__trailer.step(value), ms)
  }

  // --- Camera ---------------------------------------------------------------------

  /**
   * Starts a camera move: towards an element, a page point, or back to the
   * whole screen (`camera(null)`). It runs on its own over the next frames,
   * so the scene keeps clicking and typing while the camera travels.
   * `fx`/`fy` pick the spot on the element to centre (as fractions of its box).
   */
  async camera(
    target,
    {
      zoom = 1.6,
      seconds = 0.9,
      fx = 0.5,
      fy = 0.5,
      ease = easeInOutCubic,
      drift = 0,
      driftMax = 0.18,
    } = {},
  ) {
    if (!this.cameraEnabled) return
    const { width, height } = this.page.viewportSize()
    let to = { x: width / 2, y: height / 2, zoom: 1 }
    if (target) {
      const point = 'x' in target ? target : await this.pointOf(target, { fx, fy })
      to = { ...point, zoom }
    }
    const from = this.#currentView()
    this.drift = target && drift ? { rate: drift, cap: to.zoom + driftMax } : null
    this.tween = { from, to, start: this.time, seconds, ease }
    if (seconds <= 0) this.#advanceCamera()
  }

  /** Waits for the current camera move to finish, recording as it goes. */
  async settleCamera() {
    while (this.tween) await this.frame()
  }

  #currentView() {
    if (this.view.zoom === 1 && this.view.x === 0 && this.view.y === 0) {
      const { width, height } = this.page.viewportSize()
      return { x: width / 2, y: height / 2, zoom: 1 }
    }
    return { ...this.view }
  }

  #advanceCamera() {
    if (!this.tween) {
      if (this.drift) {
        const zoom = Math.min(this.drift.cap, this.view.zoom + this.drift.rate / this.fps)
        this.view = { ...this.view, zoom }
      }
      return
    }
    const { from, to, start, seconds, ease } = this.tween
    const progress = seconds <= 0 ? 1 : Math.min(1, (this.time - start) / seconds)
    const t = ease(progress)
    this.view = {
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      zoom: from.zoom + (to.zoom - from.zoom) * t,
    }
    if (progress >= 1) this.tween = null
  }

  /** The rectangle of the page the camera sees, kept inside the page's edges. */
  #clip() {
    const { width, height } = this.page.viewportSize()
    const zoom = Math.max(1, this.view.zoom)
    if (zoom === 1) return { x: 0, y: 0, width, height, zoom: 1 }
    const w = width / zoom
    const h = height / zoom
    const clamp = (value, max) => Math.min(max, Math.max(0, value))
    // Snapped to the output pixel grid: a fractional origin makes text swim
    // sideways by a sub-pixel amount from one frame to the next.
    const grid = 1 / (this.scale * zoom)
    const snap = (value) => Math.round(value / grid) * grid
    return {
      x: snap(clamp(this.view.x - w / 2, width - w)),
      y: snap(clamp(this.view.y - h / 2, height - h)),
      width: w,
      height: h,
      zoom,
    }
  }

  // --- Effects --------------------------------------------------------------------

  /** A glowing frame around an element, drawn in page coordinates. */
  async focus(locator, { seconds = 1.6, pad = 10 } = {}) {
    await this.until(locator, 10)
    const box = await locator.first().boundingBox()
    if (!box) return
    await this.page.evaluate(
      ([x, y, w, h, ms]) => window.__trailer.focus(x, y, w, h, ms),
      [box.x - pad, box.y - pad, box.width + pad * 2, box.height + pad * 2, seconds * 1000],
    )
  }

  /** Centres the app's alarm card on a point (see overlay.pinAlarm). */
  async pinAlarm(point) {
    await this.page.evaluate(([x, y]) => window.__trailer.pinAlarm(x, y), [point.x, point.y])
  }

  /** A ring expanding from a point (page coordinates). */
  async pulse(point, { size = 360, color = '#8b8ce8', seconds = 1, behind = false } = {}) {
    await this.page.evaluate(
      ([x, y, s, c, ms, b]) => window.__trailer.pulse(x, y, s, c, ms, b),
      [point.x, point.y, size, color, seconds * 1000, behind],
    )
  }

  /** Confetti from a point (page coordinates). */
  async burst(point, { count = 54, spread = 520, up = 340 } = {}) {
    const colors = ['#8b8ce8', '#b9b6ff', '#6ec3f0', '#ffc857', '#5cbf92', '#e06a5a']
    const bits = Array.from({ length: count }, () => {
      const angle = this.random() * Math.PI * 2
      const force = 0.35 + this.random() * 0.65
      const round = this.random() < 0.3
      return {
        dx: Math.round(Math.cos(angle) * spread * force),
        dy: Math.round(Math.sin(angle) * spread * force * 0.7 - up * this.random()),
        fall: Math.round(180 + this.random() * 260),
        rot: Math.round((this.random() - 0.5) * 900),
        w: round ? 9 : 8 + Math.round(this.random() * 8),
        h: round ? 9 : 5 + Math.round(this.random() * 6),
        round,
        color: colors[Math.floor(this.random() * colors.length)],
        ms: 1300 + Math.round(this.random() * 700),
        delay: Math.round(this.random() * 90),
      }
    })
    await this.page.evaluate(([x, y, b]) => window.__trailer.burst(x, y, b), [point.x, point.y, bits])
  }

  // --- Overlay --------------------------------------------------------------------

  /** The lower-third caption: `style` is { color, icon } (icon as SVG markup). */
  async caption(text, style = {}) {
    await this.page.evaluate(([value, st]) => window.__trailer.caption(value, st), [text, style])
  }

  async showCursor(visible) {
    await this.page.evaluate((value) => window.__trailer.cursorVisible(value), visible)
  }
}

export function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

/** Gentle both ends, for slow moves that should not announce themselves. */
export function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2
}

/** A quick kick that overshoots a little and settles. */
export function easeOutBack(t) {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}

/** Fast start, long soft landing: a camera push that feels deliberate. */
export function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t)
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
