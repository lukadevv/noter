/**
 * The scenes, in order. Each one drives the real app (or a title card) like a
 * person would, through the frame recorder.
 *
 * Shared shape of a scene:
 *  - `prepare` runs off camera: navigation, waiting for the page to be ready;
 *  - `play` runs on camera and ends with `rec.mark('done')` once everything the
 *    viewer has to see is on screen. The editor cuts somewhere after that mark,
 *    on a beat, and the recorder keeps a few seconds of tail to choose from.
 *  - `target` is where the cut at the end of the scene should land, in seconds
 *    from the start of the trailer; the beat grid moves it slightly.
 *  - `transition` is how this scene enters (ffmpeg xfade name).
 *  - the camera (`rec.camera`) pushes in on whatever the scene is about and
 *    pulls back out; it moves on its own while the scene keeps acting.
 *  - `kind: 'card'` scenes are drawn on a separate tab with the title cards;
 *    the app tab stays booted in the background between them.
 *
 * Selectors use test ids and structure, never visible text, so the same
 * script runs in every language.
 */

import { FileText, ShieldCheck, Sun, Timer } from 'lucide'
import { easeInOutSine, easeOutExpo } from './lib/recorder.mjs'

/** A Lucide icon as inline SVG markup, for the caption badge. */
function svgOf(icon) {
  const parts = icon
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')}/>`,
    )
    .join('')
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    `stroke-linecap="round" stroke-linejoin="round">${parts}</svg>`
  )
}

/** Each section's caption wears its own colour and icon, matching the app's. */
const CAPTION = {
  home: { color: '#e0a94a', icon: svgOf(Sun) },
  notes: { color: '#8b8ce8', icon: svgOf(FileText) },
  timers: { color: '#e06a5a', icon: svgOf(Timer) },
  vault: { color: '#4fb3d9', icon: svgOf(ShieldCheck) },
}

const APP_READY = '[data-testid="app-shell"]'

/**
 * Off camera, with time stopped: moves the clock and every animation forward
 * in small steps until `done()` is true. Exit animations and lazy loading only
 * finish this way.
 */
async function pump(page, done, what) {
  for (let i = 0; i < 300; i++) {
    if (await done()) return
    await page.clock.runFor(100)
    await page.evaluate(() => window.__trailer.step(100))
    await page.waitForTimeout(20)
  }
  throw new Error(`gave up waiting for ${what}`)
}

/** Changes route off camera and waits for the new section. */
async function goto(page, base, hash, selector) {
  await page.goto(`${base}#/${hash}`)
  await page.waitForSelector(APP_READY)
  const target = page.locator(selector).first()
  await pump(page, () => target.isVisible(), `${selector} on #/${hash}`)
}

/**
 * A title card on the card page, which the runner keeps open in its own tab.
 * `prime()` brings up just its backdrop (so the incoming half of a transition
 * shows a live, correct background); `draw()` then adds the card's content.
 */
function card(page, name, copy) {
  const meta = { lang: copy.browserLocale, dir: copy.dir ?? 'ltr' }
  return {
    prime: () => page.evaluate(([n, m]) => window.__cardPrime(n, m), [name, meta]),
    draw: () => page.evaluate(([n, c, m]) => window.__card(n, c, m), [name, copy.cards, meta]),
  }
}

/**
 * A click with no recording and no actionability checks, for tidying up off
 * camera: locator.click() waits for animation frames a paused clock never gives.
 */
async function tap(page, locator) {
  const box = await locator.boundingBox()
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/**
 * Every app scene opens a touch zoomed in and eases out, so it lands with a
 * little energy without ever looking like it is lurching.
 */
async function openPush(rec) {
  const { width, height } = rec.page.viewportSize()
  await rec.camera({ x: width / 2, y: height / 2 }, { zoom: 1.07, seconds: 0 })
  await rec.camera(null, { seconds: 1.4, ease: easeOutExpo })
}

/** m:ss on the Pomodoro clock, in seconds. */
function clockSeconds(text) {
  const [minutes, seconds] = text.trim().split(':').map(Number)
  return minutes * 60 + seconds
}

/** A spot near the top of an element, `down` CSS pixels below its top edge. */
async function topOf(rec, locator, { fx = 0.5, down = 120 } = {}) {
  const point = await rec.pointOf(locator, { fx, fy: 0 })
  return { x: point.x, y: point.y + down }
}

export const scenes = [
  {
    id: 'intro',
    target: 4.5,
    transition: null,
    kind: 'card',
    async play({ rec, page, copy }) {
      const cards = card(page, 'intro', copy)
      await rec.showCursor(false)
      await cards.prime()
      await rec.hold(rec.lead)
      await cards.draw()
      rec.cue('app-soft', 0.9)
      rec.cue('shimmer', 0.5, { at: 0.4 })
      // One soft pop per feature chip as it lands.
      copy.cards.intro.features.forEach((_, i) => rec.cue('pop', 0.3, { at: 1.95 + i * 0.12 }))
      await rec.hold(3.3)
      rec.mark('done')
    },
  },

  {
    id: 'home',
    // 0: cut on the first beat after the last click instead of waiting.
    target: 0,
    transition: 'zoomin',
    async prepare({ page, base }) {
      await goto(page, base, 'home', '[data-testid="home-today"]')
    },
    async play({ rec, page, copy }) {
      await rec.showCursor(true)
      await rec.placeCursor(rec.at(0.77, 0.88))
      await openPush(rec)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.home, CAPTION.home)
      const today = page.getByTestId('home-today')
      // Frame the whole list, and let the shot creep in while it plays.
      await rec.camera(today, { zoom: 1.28, fy: 0.46, seconds: 1.3, ease: easeInOutSine, drift: 0.025 })
      await rec.focus(today, { seconds: 1.5, pad: 8 })
      await rec.hold(0.5)
      // The first due dose, then three habits (not the water one, which needs eight).
      await rec.click(today.locator('.btn--pill.btn--sm').first())
      rec.cue('ding', 0.6)
      await rec.hold(0.35)
      const checks = today.locator('[data-testid="home-habit-check"][aria-pressed="false"]')
      await rec.click(checks.first())
      rec.cue('ding', 0.7)
      await rec.hold(0.3)
      await rec.click(checks.first())
      rec.cue('ding', 0.8)
      await rec.hold(0.3)
      await rec.click(checks.last())
      rec.cue('ding', 0.9)
      await rec.hold(0.7)
      rec.mark('done')
    },
  },

  {
    id: 'notes',
    target: 20,
    transition: 'smoothleft',
    async prepare({ page, base }) {
      await goto(page, base, 'notes', '[data-testid="note-list"]')
    },
    async play({ rec, page, copy }) {
      const { typing } = copy
      await rec.placeCursor(rec.at(0.72, 0.74))
      await openPush(rec)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.notes, CAPTION.notes)

      const note = page
        .getByTestId('note-item')
        .filter({ has: page.getByTestId('note-item-title').filter({ hasText: typing.title }) })
      await rec.click(note)
      await rec.until(page.locator('.cm-content'))

      // Close up on the page being written, so every keystroke reads.
      const editor = page.locator('.cm-content')
      // Text starts at the left edge, or the right one in a right-to-left language.
      const fx = copy.dir === 'rtl' ? 0.68 : 0.32
      await rec.camera(await topOf(rec, editor, { fx, down: 110 }), {
        zoom: 1.55,
        seconds: 1.2,
        ease: easeInOutSine,
        drift: 0.02,
      })
      await rec.click(page.locator('.cm-content .cm-line').last(), { gain: 0.5 })
      await page.keyboard.press('Control+End')
      await rec.press('Enter')
      await rec.settleCamera()

      // A block from the / menu, picked with the mouse so it is easy to follow.
      const menu = page.locator('.cm-tooltip-autocomplete li')
      await rec.type('/check', { cps: 11 })
      await rec.until(menu, 5)
      await rec.hold(0.35)
      await rec.click(menu.first(), { sound: 'pop', gain: 0.7, settle: 0.35 })
      for (const [i, task] of typing.tasks.entries()) {
        if (i > 0) await rec.press('Enter')
        await rec.type(task, { cps: 18 })
      }
      // Enter on an empty item ends the list; one more leaves a blank line, so
      // the next paragraph is not read as part of the last task.
      await rec.press('Enter')
      await rec.press('Enter')
      await rec.press('Enter')

      // A wiki link: type a few letters after [[ and pick the note.
      await rec.type(`${typing.see} [[`, { cps: 16 })
      await rec.type(typing.linkTyped ?? typing.link.slice(0, 5), { cps: 9 })
      await rec.until(menu, 5)
      await rec.hold(0.4)
      await rec.click(menu.first(), { sound: 'pop', gain: 0.7, settle: 0.3 })

      // And a tag.
      await rec.type(` #${typing.tag}`, { cps: 15 })
      await rec.press('Escape', { sound: null })

      // Tick the first task.
      await rec.click(page.locator('.cm-task-checkbox').first(), { settle: 0.1 })
      rec.cue('ding', 0.6)
      await rec.hold(0.4)

      // Pull back: the new tag is already in the sidebar.
      await rec.camera(null, { seconds: 1, ease: easeInOutSine })
      await rec.hold(0.8)
      rec.mark('done')
    },
  },

  {
    id: 'timers',
    target: 27.5,
    transition: 'radial',
    async prepare({ page, base }) {
      await goto(page, base, 'timers/alarms', '[data-testid="timer-preset"]')
    },
    async play({ rec, page, copy }) {
      await rec.placeCursor(rec.at(0.85, 0.88))
      await openPush(rec)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.timers, CAPTION.timers)
      // Glide along the coloured presets.
      const presets = page.getByTestId('timer-preset')
      await rec.camera(presets.nth(2), { zoom: 1.22, seconds: 1, ease: easeInOutSine })
      await rec.moveTo(await rec.pointOf(presets.nth(0), { fy: 0.6 }), { seconds: 0.45 })
      await rec.moveTo(await rec.pointOf(presets.nth(4), { fy: 0.6 }), { seconds: 0.6 })

      await rec.camera(null, { seconds: 0.6, ease: easeInOutSine })
      await rec.click(page.getByTestId('timer-tabs').getByRole('tab').nth(1))
      await rec.until(page.getByTestId('pomodoro-clock'))
      const clock = page.getByTestId('pomodoro-clock')
      await rec.click(page.getByTestId('pomodoro-toggle'))
      await rec.camera(clock, { zoom: 1.5, fy: 0.62, seconds: 0.9, ease: easeInOutSine, drift: 0.03 })
      await rec.hold(0.4)

      // Time-lapse: the minutes run down in under a second, leaving three to
      // play out in real time. The remaining time is read off the clock, so
      // the finish lands where it should however long the setup took.
      const lapse = clockSeconds(await clock.textContent()) - 3.15
      const frames = Math.round(0.9 * rec.fps)
      let done = 0
      rec.cue('whoosh', 0.35)
      const center = await rec.pointOf(clock)
      for (let i = 1; i <= frames; i++) {
        if (i % 18 === 1) await rec.pulse(center, { size: 280, color: '#e06a5a', seconds: 0.8 })
        const t = 1 - (1 - i / frames) ** 2
        const target = Math.round(lapse * t * 1000)
        await page.clock.fastForward(target - done)
        done = target
        await rec.frame()
      }

      await rec.pinAlarm(center)
      // The last three seconds, one beat each: the camera leans in, a ring
      // goes out from the clock and a tick sounds on every number.
      await rec.camera(clock, { zoom: 1.85, fy: 0.62, seconds: 3, ease: easeInOutSine, drift: 0.04 })
      const ringing = page.getByTestId('ringing')
      for (let second = 0; second < 6; second++) {
        if (await ringing.isVisible()) break
        if (second < 3) {
          rec.cue('click', 0.55)
          await rec.pulse(center, { size: 340 + second * 60, color: '#e06a5a', seconds: 0.95 })
        }
        await rec.hold(second < 3 ? 1 : 0.3)
      }

      // Time's up. The alarm card normally opens in the middle of the screen,
      // away from the clock, so it is pinned onto the clock: the rings then
      // come out from behind the card and the confetti sprays from its middle.
      await rec.until(ringing, 5)
      rec.cue('app-digital', 0.8)
      rec.cue('shimmer', 0.4)
      await rec.pulse(center, { size: 620, color: '#e06a5a', seconds: 1, behind: true })
      await rec.pulse(center, { size: 980, color: '#ffc857', seconds: 1.4, behind: true })
      await rec.burst(center, { count: 64, spread: 620, up: 300 })
      await rec.hold(1.6)
      rec.mark('done')
    },
  },

  {
    id: 'vault',
    target: 37,
    transition: 'smoothup',
    async prepare({ page, base }) {
      // The pomodoro is still ringing from the last scene: line up the break.
      const ringing = page.getByTestId('ringing')
      if (await ringing.isVisible()) {
        await tap(page, ringing.locator('.btn--primary').first())
        await pump(page, async () => (await ringing.count()) === 0, 'the alarm to close')
      }
      await goto(page, base, 'vault', '[data-testid="vault-password"]')
    },
    async play({ rec, page, copy }) {
      await rec.placeCursor(rec.at(0.81, 0.83))
      await openPush(rec)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.vault, CAPTION.vault)
      const password = page.getByTestId('vault-password')
      await rec.camera(password, { zoom: 1.5, seconds: 1, ease: easeInOutSine, drift: 0.03 })
      await rec.click(password, { gain: 0.5 })
      await rec.type(copy.demo.vaultPassword, { cps: 34, gain: 0.2 })
      const submit = page.locator('form button[type="submit"]').first()
      await rec.click(submit, { sound: 'lock' })
      // Unlocking runs PBKDF2 in real time; the frozen video does not see the wait.
      await rec.until(page.getByTestId('secret-item').first())
      await rec.pulse(rec.cursor, { size: 300, color: '#5cbf92', seconds: 0.9 })
      await rec.camera(null, { seconds: 0.7, ease: easeInOutSine })
      await rec.hold(0.2)

      // The second entry in the list, then its password.
      await rec.click(page.getByTestId('secret-item').nth(1))
      const detail = page.getByTestId('secret-detail')
      await rec.until(detail)
      const value = detail.getByTestId('value-password')
      await rec.camera(value, { zoom: 1.5, seconds: 0.8, ease: easeInOutSine, drift: 0.03 })
      await rec.focus(value, { seconds: 1.6, pad: 8 })
      await rec.click(value.locator('xpath=following-sibling::span[1]/button[1]'))
      await rec.hold(0.7)

      // Folder encryption: a locked folder in Notes, opened with its passphrase.
      await rec.camera(null, { seconds: 0.6, ease: easeInOutSine })
      await rec.click(page.getByTestId('nav-notes'), { gain: 0.6 })
      const folder = page
        .getByTestId('folder-row')
        .filter({ hasText: copy.demo.folders.find((f) => f.encrypted).name })
      await rec.click(folder.getByTestId('folder-label'))
      await rec.until(page.getByTestId('note-item').first())
      await rec.click(page.getByTestId('note-item').first())
      const prompt = page.getByTestId('lock-prompt')
      await rec.until(prompt)
      await rec.camera(prompt, { zoom: 1.45, fy: 0.6, seconds: 0.8, ease: easeInOutSine, drift: 0.03 })
      await rec.click(prompt.locator('input'), { gain: 0.5 })
      await rec.type(copy.demo.folderPassphrase, { cps: 36, gain: 0.2 })
      await rec.click(prompt.locator('button'), { sound: 'lock' })
      await rec.until(page.locator('.cm-content'))
      await rec.pulse(rec.cursor, { size: 300, color: '#5cbf92', seconds: 0.9 })
      await rec.camera(null, { seconds: 0.8, ease: easeInOutSine })
      await rec.hold(0.8)
      rec.mark('done')
    },
  },

  {
    id: 'localFirst',
    target: 41,
    transition: 'circleopen',
    kind: 'card',
    async play({ rec, page, copy }) {
      const cards = card(page, 'localFirst', copy)
      await rec.showCursor(false)
      await cards.prime()
      await rec.hold(rec.lead)
      await cards.draw()
      copy.cards.localFirst.statements.forEach((_, i) => rec.cue('pop', 0.55, { at: 0.12 + i * 0.42 }))
      copy.cards.localFirst.platforms.forEach((_, i) => rec.cue('key', 0.4, { at: 1.75 + i * 0.09 }))
      // Swells into the cut to the closing card.
      rec.cue('riser', 0.7, { fromEnd: 2.6 })
      await rec.hold(3)
      rec.mark('done')
    },
  },

  {
    id: 'outro',
    target: 45.5,
    transition: 'fade',
    kind: 'card',
    last: true,
    async play({ rec, page, copy }) {
      const cards = card(page, 'outro', copy)
      await rec.showCursor(false)
      await cards.prime()
      await rec.hold(rec.lead)
      await cards.draw()
      // Half a second of silence after the music stops, then the final accent.
      rec.cue('app-bell', 0.7, { at: 0.5 })
      rec.cue('shimmer', 0.45, { at: 0.5 })
      // The address types itself out.
      ;[...copy.cards.outro.url].forEach((_, i) => rec.cue('key', 0.22, { at: 0.8 + i * 0.045 }))
      rec.cue('pop', 0.6, { at: 0.8 + copy.cards.outro.url.length * 0.045 + 0.15 })
      await rec.hold(3.6)
      rec.mark('done')
      rec.mark('poster')
    },
  },
]
