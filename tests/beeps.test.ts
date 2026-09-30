import { describe, expect, it } from 'vitest'
import { hzToNote, noteToHz, parseMelody, patternMs, BUILTIN_SOUNDS } from '$lib/audio/beeps'

describe('alarm sounds', () => {
  it('converts note names and pitches both ways', () => {
    expect(noteToHz('A4')).toBe(440)
    expect(noteToHz('A5')).toBe(880)
    expect(noteToHz('C#5')).toBeCloseTo(554.37, 1)
    expect(noteToHz('-')).toBe(0)
    expect(noteToHz('H2')).toBeNull()
    expect(hzToNote(440)).toBe('A4')
    expect(hzToNote(1046.5)).toBe('C6')
    expect(hzToNote(0)).toBe('-')
  })

  it('parses a melody and rejects nonsense', () => {
    expect(parseMelody('A5 - A5')).toEqual([880, 0, 880])
    expect(parseMelody('A5 nope')).toBeNull()
    expect(parseMelody('')).toBeNull()
  })

  it('round-trips every built-in pitch through its note name', () => {
    for (const sound of BUILTIN_SOUNDS) {
      for (const hz of sound.recipe.notes) {
        if (hz > 0) expect(noteToHz(hzToNote(hz))).toBeCloseTo(hz, 0)
      }
      expect(patternMs(sound.recipe)).toBeGreaterThan(0)
    }
  })
})
