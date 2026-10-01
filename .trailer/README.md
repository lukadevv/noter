# Trailer

A short promotional video of Noter, generated from code: the real app, filled
with demo data, driven like a user would drive it, recorded frame by frame and
edited to the beat of the music. When the UI changes, run it again.

Outputs, per language, in `.trailer/out/<lang>/` (ignored by git):

| File                              | For                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `noter-trailer-<lang>.mp4`        | Microsoft Store trailer, social media. 1920×1080, 60 fps, H.264 + AAC               |
| `noter-trailer-<lang>-web.mp4`    | README and GitHub releases. 1280×720, 30 fps, small enough for GitHub's 10 MB limit |
| `noter-trailer-<lang>-poster.png` | Store trailer thumbnail (1920×1080), taken from the closing card                    |
| `timeline.json`                   | Where every scene and sound landed, for checking the edit                           |

## Running it

Needs Node, pnpm, ffmpeg and Playwright's Chromium.

```sh
winget install ffmpeg                    # once, then open a new terminal
pnpm exec playwright install chromium     # once
pnpm trailer --check                     # lists what is missing, renders nothing
pnpm trailer                             # every language in config.mjs
pnpm trailer --lang es                   # one language; also es,en or all
pnpm trailer --draft                     # 720p at 30 fps, about twice as fast
pnpm trailer --keep                      # keep the per-scene recordings in .cache/
```

If ffmpeg is installed somewhere not on `PATH`, set `FFMPEG_PATH` and
`FFPROBE_PATH`. A full-quality language takes a few minutes.

The run never stops for a missing asset. It warns and carries on:

- **No music:** the trailer is rendered with effects only, cut to a fixed grid.
- **No file for an effect:** a synthesised stand-in is used.
- **Music not listed in `assets/CREDITS.md`:** a reminder to record its licence.

It does stop when ffmpeg or Chromium is missing, or when a language has no
text file.

## Assets

```
.trailer/assets/music.mp3      the track (or .wav, .m4a, .ogg, .flac)
.trailer/assets/sfx/<name>.wav click, key, pop, ding, whoosh, lock, riser, shimmer
.trailer/assets/CREDITS.md     where each one came from, and its licence
```

None of the audio is committed. Fill in `CREDITS.md` so the same files can be
fetched again.

**Music:** minimal electronic or upbeat lo-fi, 95-115 BPM, no vocals, from a
source that allows commercial use: Pixabay Music, Uppbeat (with credit),
Incompetech (CC BY) or Free Music Archive (CC0 or CC BY only, never NC). If the
licence asks for credit, add it to the Store description and the release notes
too.

**Effects:** Kenney "UI Audio" (CC0), Freesound filtered by CC0, or Mixkit.
The alarm sounds (`app-soft`, `app-digital`, `app-bell`) are always rendered
from the app's own recipes in `src/lib/audio/beeps.ts`, so they need no file.

## Languages

Each language is one file, `copy/<lang>.mjs`: the card text, the captions, what
gets typed and all the demo data (notes, folders, habits, medication, timers,
vault entries). To add one, copy `copy/en.mjs`, translate every string, and add
the code to `languages` in `config.mjs` (or pass `--lang`). The code must be a
locale the app ships (`src/lib/i18n/locales/`), since the app runs in it.

## How it works

| Part                                          | File                                  |
| --------------------------------------------- | ------------------------------------- |
| Entry point, checks, per-language loop        | `run.mjs`                             |
| Settings: resolution, clock, music, mix       | `config.mjs`                          |
| The scenes and the script                     | `scenes.mjs`                          |
| Demo data, written with the app's own modules | `app/seed.ts`                         |
| Title cards (HTML/CSS)                        | `app/card.*`                          |
| Sound effects rendered in Chromium            | `app/sounds.ts`                       |
| Frame-by-frame capture on virtual time        | `lib/recorder.mjs`, `lib/overlay.mjs` |
| Tempo and beat detection                      | `lib/beats.mjs`                       |
| Cut planning, transitions and mix             | `lib/edit.mjs`                        |

**Demo data.** The run starts the Vite dev server and opens
`app/seed.html`, a blank page on the app's origin that imports `app/seed.ts`.
That module writes through the app's own Dexie database and crypto, so the
vault and the encrypted folder are real. Seeding happens before the app boots,
so nothing in the app overwrites it, and the welcome tour is marked as done.

**Capture.** No `recordVideo`. Time in the page is stopped: Playwright's fake
clock drives `Date`, timers and `requestAnimationFrame`, and the DevTools
protocol freezes the animation timeline. For each frame the recorder moves both
forward by exactly 1/60 s, takes a screenshot and pipes it to ffmpeg. Rendering
can be slow and the video still plays at a perfect 60 fps, the same on every
run. The cursor and the captions are an overlay the recorder injects. Waits
that take real time (unlocking the vault runs PBKDF2) happen off camera.

**Edit.** Each scene is recorded with a still lead-in and a few seconds of tail.
The music's tempo and beats are detected in plain JavaScript (spectral flux,
autocorrelation, grid phase), and each cut goes to the beat nearest its
scripted time, preferring the first beat of a bar, never before the scene has
finished. If detection gets a track wrong, set `music.bpm` and
`music.firstBeat` in `config.mjs`. Transitions are ffmpeg `xfade` fades and
slides centred on the cut. Sound effects are placed from cues the scenes
record and summed into one track; in the final mix the music ducks under them
(sidechain compression), stops before the closing card for half a second of
silence and the final accent, and everything is normalised to -14 LUFS.
