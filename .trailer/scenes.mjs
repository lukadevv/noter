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
 *  - `kind: 'card'` scenes are drawn on a separate tab with the title cards;
 *    the app tab stays booted in the background between them.
 *
 * Selectors use test ids and structure, never visible text, so the same
 * script runs in every language.
 */

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

/** Draws a title card on the card page, which the runner keeps open in its own tab. */
function card(page, name, copy) {
  return () => page.evaluate(([n, c]) => window.__card(n, c), [name, copy.cards])
}

/**
 * A click with no recording and no actionability checks, for tidying up off
 * camera: locator.click() waits for animation frames a paused clock never gives.
 */
async function tap(page, locator) {
  const box = await locator.boundingBox()
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

/** Polls the page once per recorded frame until `check` is true or `seconds` pass. */
async function holdUntilVisible(rec, locator, seconds) {
  const frames = Math.round(seconds * rec.fps)
  for (let i = 0; i < frames; i++) {
    if (await locator.isVisible()) return true
    await rec.frame()
  }
  return false
}

export const scenes = [
  {
    id: 'intro',
    target: 4,
    transition: null,
    kind: 'card',
    async play({ rec, page, copy }) {
      const draw = card(page, 'intro', copy)
      await rec.showCursor(false)
      await rec.hold(rec.lead)
      await draw()
      rec.cue('app-soft', 0.9)
      rec.cue('shimmer', 0.55)
      await rec.hold(2.6)
      rec.mark('done')
    },
  },

  {
    id: 'home',
    target: 10,
    transition: 'fade',
    async prepare({ page, base }) {
      await goto(page, base, 'home', '[data-testid="home-today"]')
    },
    async play({ rec, page, copy }) {
      await rec.showCursor(true)
      await rec.placeCursor(1180, 760)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.home)
      await rec.hold(0.7)
      const today = page.getByTestId('home-today')
      // The first due dose: the "Taken" pill on the medication row.
      await rec.click(today.locator('.btn--pill.btn--sm').first(), { sound: 'click' })
      rec.cue('ding', 0.6)
      await rec.hold(0.7)
      await rec.click(today.getByTestId('home-habit-check').first(), { sound: 'click' })
      rec.cue('ding', 0.8)
      await rec.hold(1)
      rec.mark('done')
    },
  },

  {
    id: 'notes',
    target: 18.5,
    transition: 'smoothleft',
    async prepare({ page, base }) {
      await goto(page, base, 'notes', '[data-testid="note-list"]')
    },
    async play({ rec, page, copy }) {
      const { typing } = copy
      await rec.placeCursor(1100, 640)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.notes)

      const note = page
        .getByTestId('note-item')
        .filter({ has: page.getByTestId('note-item-title').filter({ hasText: typing.title }) })
      await rec.click(note)
      await rec.until(page.locator('.cm-content'))
      await rec.hold(0.3)

      // Into the editor, at the end of the note.
      await rec.click(page.locator('.cm-content .cm-line').last(), { sound: 'click', gain: 0.5 })
      await page.keyboard.press('Control+End')
      await rec.press('Enter')

      // A block from the / menu.
      await rec.type('/check')
      await rec.hold(0.45)
      await rec.press('Enter', { sound: 'pop', gain: 0.7, settle: 0.3 })
      for (const [i, task] of typing.tasks.entries()) {
        if (i > 0) await rec.press('Enter')
        await rec.type(task, { cps: 20 })
      }
      // Enter on an empty item ends the list.
      await rec.press('Enter')
      await rec.press('Enter')

      // A wiki link, completed from the [[ menu.
      await rec.type(`${typing.see} [[${typing.link.slice(0, 5)}`, { cps: 18 })
      await rec.hold(0.45)
      await rec.press('Enter', { sound: 'pop', gain: 0.7, settle: 0.25 })
      await page.keyboard.press('End')

      // And a tag.
      await rec.type(` #${typing.tag}`, { cps: 16 })
      await rec.press('Escape', { sound: null })
      await rec.hold(0.9)
      rec.mark('done')
    },
  },

  {
    id: 'timers',
    target: 25,
    transition: 'smoothleft',
    async prepare({ page, base }) {
      await goto(page, base, 'timers/alarms', '[data-testid="timer-preset"]')
    },
    async play({ rec, page, copy }) {
      await rec.placeCursor(1300, 760)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.timers)
      // A pass over the coloured presets.
      const presets = page.getByTestId('timer-preset')
      await rec.moveTo(await rec.pointOf(presets.nth(0), { fy: 0.6 }), { seconds: 0.45 })
      await rec.moveTo(await rec.pointOf(presets.nth(3), { fy: 0.6 }), { seconds: 0.55 })

      await rec.click(page.getByTestId('timer-tabs').getByRole('tab').nth(1))
      await rec.until(page.getByTestId('pomodoro-clock'))
      await rec.hold(0.3)
      await rec.click(page.getByTestId('pomodoro-toggle'))
      await rec.hold(0.6)

      // Time-lapse: 25 minutes run down in under a second, then real time for
      // the last few seconds so the ring lands on screen.
      const lapse = 25 * 60 - 4 - 0.6
      const frames = Math.round(0.9 * rec.fps)
      let done = 0
      rec.cue('whoosh', 0.35)
      for (let i = 1; i <= frames; i++) {
        const t = 1 - (1 - i / frames) ** 2
        const target = Math.round(lapse * t * 1000)
        await page.clock.fastForward(target - done)
        done = target
        await rec.frame()
      }
      const ringing = page.getByTestId('ringing')
      if (await holdUntilVisible(rec, ringing, 6)) rec.cue('app-digital', 0.8)
      await rec.hold(1.3)
      rec.mark('done')
    },
  },

  {
    id: 'vault',
    target: 33,
    transition: 'smoothleft',
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
      await rec.placeCursor(1250, 720)
      await rec.hold(rec.lead)
      await rec.caption(copy.captions.vault)
      await rec.click(page.getByTestId('vault-password'), { gain: 0.5 })
      await rec.type(copy.demo.vaultPassword, { cps: 34, gain: 0.2 })
      await rec.click(page.locator('form button[type="submit"]').first(), { sound: 'lock' })
      // Unlocking runs PBKDF2 in real time; the frozen video does not see the wait.
      await rec.until(page.getByTestId('secret-item').first())
      await rec.hold(0.5)

      await rec.click(page.getByTestId('secret-item').first())
      const detail = page.getByTestId('secret-detail')
      await rec.until(detail)
      await rec.hold(0.35)
      const reveal = detail
        .getByTestId('value-password')
        .locator('xpath=following-sibling::span[1]/button[1]')
      await rec.click(reveal)
      await rec.hold(0.8)

      // Folder encryption: a locked folder in Notes, opened with its passphrase.
      await rec.click(page.getByTestId('nav-notes'), { sound: 'click', gain: 0.6 })
      const folder = page
        .getByTestId('folder-row')
        .filter({ hasText: copy.demo.folders.find((f) => f.encrypted).name })
      await rec.click(folder.getByTestId('folder-label'))
      await rec.until(page.getByTestId('note-item').first())
      await rec.hold(0.2)
      await rec.click(page.getByTestId('note-item').first())
      const prompt = page.getByTestId('lock-prompt')
      await rec.until(prompt)
      await rec.click(prompt.locator('input'), { gain: 0.5 })
      await rec.type(copy.demo.folderPassphrase, { cps: 36, gain: 0.2 })
      await rec.click(prompt.locator('button'), { sound: 'lock' })
      await rec.until(page.locator('.cm-content'))
      await rec.hold(1)
      rec.mark('done')
    },
  },

  {
    id: 'localFirst',
    target: 37.5,
    transition: 'fade',
    kind: 'card',
    async play({ rec, page, copy }) {
      const draw = card(page, 'localFirst', copy)
      await rec.showCursor(false)
      await rec.hold(rec.lead)
      await draw()
      rec.cue('pop', 0.5, { at: 0.15 })
      rec.cue('pop', 0.5, { at: 0.53 })
      rec.cue('pop', 0.5, { at: 0.91 })
      // Swells into the cut to the closing card.
      rec.cue('riser', 0.7, { fromEnd: 2.6 })
      await rec.hold(2.8)
      rec.mark('done')
    },
  },

  {
    id: 'outro',
    target: 42,
    transition: 'fade',
    kind: 'card',
    last: true,
    async play({ rec, page, copy }) {
      const draw = card(page, 'outro', copy)
      await rec.showCursor(false)
      await rec.hold(rec.lead)
      await draw()
      // Half a second of silence after the music stops, then the final accent.
      rec.cue('app-bell', 0.7, { at: 0.5 })
      rec.cue('shimmer', 0.45, { at: 0.5 })
      await rec.hold(3.4)
      rec.mark('done')
      rec.mark('poster')
    },
  },
]
