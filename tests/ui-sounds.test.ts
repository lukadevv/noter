// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { classifyClick, DEFAULT_UI_SOUNDS, UI_SOUND_IDS, UI_SOUNDS, UiSounds } from '$lib/audio/ui-sounds'
import type { UiSoundSettings } from '$lib/audio/ui-sounds'
import { migrateSettings } from '$lib/db/repo/settings'

function el(html: string): Element {
  document.body.innerHTML = html
  return document.body.querySelector('[data-target]')!
}

describe('which sound a click makes', () => {
  it('follows the kind of control', () => {
    expect(classifyClick(el('<button data-target class="btn btn--primary">Save</button>'))).toBe('primary')
    expect(classifyClick(el('<button data-target class="btn">Cancel</button>'))).toBe('secondary')
    expect(classifyClick(el('<button data-target class="btn btn--ghost btn--icon">x</button>'))).toBe(
      'secondary',
    )
    expect(classifyClick(el('<button data-target class="btn btn--danger">Delete</button>'))).toBe('delete')
    expect(classifyClick(el('<div role="tablist"><button data-target role="tab">A</button></div>'))).toBe(
      'tab',
    )
  })

  it('lets data-ui-sound name a sound or turn it off, on the control or around it', () => {
    expect(classifyClick(el('<button data-target data-ui-sound="tab">Home</button>'))).toBe('tab')
    expect(classifyClick(el('<button data-target data-ui-sound="none">Preview</button>'))).toBeNull()
    expect(classifyClick(el('<div data-ui-sound="none"><button data-target>x</button></div>'))).toBeNull()
    expect(classifyClick(el('<button data-target data-ui-sound="nope">x</button>'))).toBe('secondary')
  })

  it('uses the nearest button for a click on its icon, and ignores anything else', () => {
    expect(classifyClick(el('<button class="btn btn--primary"><svg data-target></svg></button>'))).toBe(
      'primary',
    )
    expect(classifyClick(el('<p data-target>text</p>'))).toBeNull()
    expect(classifyClick(el('<button data-target disabled>x</button>'))).toBeNull()
    expect(classifyClick(null)).toBeNull()
  })
})

describe('playing', () => {
  let played: string[]
  let settings: UiSoundSettings
  let sounds: UiSounds

  beforeEach(() => {
    vi.useFakeTimers()
    played = []
    settings = { ...DEFAULT_UI_SOUNDS, muted: [] }
    const engine = {
      unlock: () => {},
      preview: (recipe: { notes: number[] }) => {
        const id = UI_SOUND_IDS.find((i) => UI_SOUNDS[i].notes.join() === recipe.notes.join())
        played.push(id ?? 'reversed')
        return 0
      },
    }
    sounds = new UiSounds(() => settings, engine)
  })

  afterEach(() => vi.useRealTimers())

  const button = () => el('<button data-target class="btn btn--primary">Go</button>')

  it('plays a click once, after its handlers have run', () => {
    sounds.click(button())
    expect(played).toEqual([])
    vi.advanceTimersByTime(1)
    expect(played).toEqual(['primary'])
  })

  it('lets create, complete, delete and error replace the click sound, and nothing else', () => {
    sounds.click(button())
    sounds.play('menu')
    sounds.play('dialog')
    sounds.play('complete')
    vi.advanceTimersByTime(1)
    expect(played).toEqual(['complete'])
  })

  it('plays right away when no click is in flight', () => {
    sounds.play('menu')
    expect(played).toEqual(['menu'])
  })

  it('plays a closing dialog backwards', () => {
    sounds.play('dialog', { reverse: true })
    expect(played).toEqual(['reversed'])
  })

  it('stays silent when switched off, or when that one sound is', () => {
    settings = { ...settings, muted: ['menu'] }
    sounds.play('menu')
    sounds.play('create')
    expect(played).toEqual(['create'])
    settings = { ...settings, enabled: false }
    vi.advanceTimersByTime(100)
    sounds.play('create')
    expect(played).toEqual(['create'])
  })

  it('still previews a muted sound in settings', () => {
    settings = { ...settings, enabled: false }
    sounds.preview('tab')
    expect(played).toEqual(['tab'])
  })

  it('treats the same sound twice within a few milliseconds as one', () => {
    sounds.play('tab')
    sounds.play('tab')
    vi.advanceTimersByTime(60)
    sounds.play('tab')
    expect(played).toEqual(['tab', 'tab'])
  })
})

describe('settings', () => {
  it('turns sounds on for stored settings that predate them', () => {
    const migrated = migrateSettings({ themeId: 'light' })
    expect(migrated.sounds).toEqual({ enabled: true, volume: 0.4, muted: [] })
  })

  it('keeps what the user chose and fills in what is missing', () => {
    const migrated = migrateSettings({
      sounds: { enabled: false, muted: ['tab'] } as UiSoundSettings,
    })
    expect(migrated.sounds).toEqual({ enabled: false, volume: 0.4, muted: ['tab'] })
  })
})
