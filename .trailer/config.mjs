/**
 * Trailer settings. Everything here can stay as is; the usual things to touch
 * are the music block (once a track is chosen) and `languages`.
 */
export default {
  /** Rendered by `pnpm trailer` with no --lang. Each needs copy/<lang>.mjs. */
  languages: ['es', 'en'],

  video: {
    width: 1920,
    height: 1080,
    fps: 60,
    /**
     * The app is laid out at width / scale CSS pixels and rendered at full
     * resolution, so text reads well on a phone without looking zoomed in.
     */
    scale: 1.25,
    /** Length of every transition, centred on the cut. */
    transition: 0.5,
    /** Still pre-roll at the start of each recording (the transition's in-half). */
    lead: 0.5,
  },

  /** The day the app believes it is. Fixed, so every run looks the same. */
  clock: { time: '2026-03-10T09:30:00Z', timezone: 'UTC' },

  music: {
    /**
     * The track. Any of these names in .trailer/assets/ is picked up; set
     * `file` to use another name.
     */
    candidates: ['music.mp3', 'music.wav', 'music.m4a', 'music.ogg', 'music.flac'],
    file: null,
    /** Seconds into the track where the trailer starts (skip a long intro). */
    start: 0,
    /**
     * Set both to skip beat detection: the tempo, and the time in seconds
     * (counted from `start`) of a beat that falls on the first bar.
     */
    bpm: null,
    firstBeat: null,
    /** The detector's prior: what tempo to expect when the track is ambiguous. */
    expectBpm: 105,
    /** Beat grid used when there is no music at all. */
    fallbackBpm: 105,
  },

  audio: {
    musicGain: 0.8,
    effectsGain: 1,
    musicFadeIn: 0.2,
    /** The music stops this fast before the closing card. */
    musicFadeOut: 0.25,
    /** Music ducks under effects: a sidechain compressor keyed by the effects. */
    duck: { threshold: 0.03, ratio: 6, attack: 10, release: 280 },
    /** Integrated loudness target, LUFS. -14 is what YouTube and most socials use. */
    loudness: -14,
  },

  /**
   * Interface sounds, looked up as .trailer/assets/sfx/<name>.(wav|mp3|ogg|flac).
   * A missing file is replaced by a synthesised stand-in, with a warning.
   * `app-*` sounds are always rendered from the app's own recipes.
   */
  effects: ['click', 'key', 'pop', 'ding', 'whoosh', 'lock', 'riser', 'shimmer'],
}
