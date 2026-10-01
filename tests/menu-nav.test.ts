import { describe, expect, it } from 'vitest'
import { nextIndex, placeMenu, typeahead } from '$lib/menu/nav'
import { formatShortcut } from '$lib/ui/keys'
import { DEFAULT_SETTINGS, migrateSettings } from '$lib/db/repo/settings'

describe('menu keyboard navigation', () => {
  const items = [{}, { disabled: true }, {}, {}]

  it('skips disabled items and wraps', () => {
    expect(nextIndex(items, 0, 'ArrowDown')).toBe(2)
    expect(nextIndex(items, 3, 'ArrowDown')).toBe(0)
    expect(nextIndex(items, 0, 'ArrowUp')).toBe(3)
    expect(nextIndex(items, -1, 'ArrowDown')).toBe(0)
  })

  it('jumps to the ends', () => {
    expect(nextIndex(items, 2, 'Home')).toBe(0)
    expect(nextIndex(items, 0, 'End')).toBe(3)
  })

  it('finds items by their first letter', () => {
    const labels = [{ label: 'Pin' }, { label: 'Archive' }, { label: 'Paste' }]
    expect(typeahead(labels, 0, 'p')).toBe(2)
    expect(typeahead(labels, 2, 'a')).toBe(1)
  })
})

describe('placeMenu', () => {
  const viewport = { width: 800, height: 600 }

  it('hangs below its anchor when there is room', () => {
    expect(placeMenu({ x: 100, y: 100, height: 20 }, { width: 200, height: 150 }, viewport)).toEqual({
      x: 100,
      y: 120,
    })
  })

  it('flips above and to the left near the edges', () => {
    const at = placeMenu({ x: 700, y: 550, width: 30, height: 20 }, { width: 200, height: 150 }, viewport)
    expect(at).toEqual({ x: 530, y: 400 })
  })

  it('opens a submenu beside its row, on the other side when there is no room', () => {
    const row = { left: 400, right: 600 }
    expect(placeMenu({ x: 600, y: 100 }, { width: 150, height: 100 }, viewport, 8, row)).toEqual({
      x: 600,
      y: 100,
    })
    // 600 + 250 overflows: the submenu ends where the row starts instead of covering it.
    expect(placeMenu({ x: 600, y: 100 }, { width: 250, height: 100 }, viewport, 8, row)).toEqual({
      x: 150,
      y: 100,
    })
    expect(
      placeMenu({ x: 600, y: 100 }, { width: 150, height: 100 }, viewport, 8, { ...row, rtl: true }),
    ).toEqual({
      x: 250,
      y: 100,
    })
  })

  it('slides a tall submenu up instead of flipping it above the row', () => {
    const at = placeMenu({ x: 600, y: 500 }, { width: 150, height: 300 }, viewport, 8, {
      left: 400,
      right: 600,
    })
    expect(at).toEqual({ x: 600, y: 292 })
  })
})

describe('formatShortcut', () => {
  it('uses the platform modifier', () => {
    expect(formatShortcut('Mod+Shift+K', false)).toBe('Ctrl+Shift+K')
    expect(formatShortcut('Mod+Shift+K', true)).toBe('⌘⇧K')
  })
})

describe('migrateSettings', () => {
  it('maps the old reduce-motion checkbox to motion off', () => {
    expect(migrateSettings({ reduceMotion: true }).motion).toBe('off')
    expect(migrateSettings({ reduceMotion: false }).motion).toBe('system')
  })

  it('fills in nested defaults added after the group was stored', () => {
    const migrated = migrateSettings({ dailyNotes: { folderId: 'f1' } as never })
    expect(migrated.dailyNotes).toEqual({ ...DEFAULT_SETTINGS.dailyNotes, folderId: 'f1' })
  })

  it('drops the old daily-notes switch', () => {
    const migrated = migrateSettings({ dailyNotes: { enabled: false } as never })
    expect(migrated.dailyNotes).toEqual(DEFAULT_SETTINGS.dailyNotes)
  })

  it('keeps the chosen widget order and appends widgets it has not seen', () => {
    const migrated = migrateSettings({
      home: {
        widgets: [
          { id: 'recent', visible: false },
          { id: 'gone' as never, visible: true },
        ],
        dailyDismissed: '',
        layoutVersion: 2,
      },
    })
    expect(migrated.home.widgets[0]).toEqual({ id: 'recent', visible: false })
    expect(migrated.home.widgets.map((w) => w.id)).not.toContain('gone')
    expect(migrated.home.widgets).toHaveLength(DEFAULT_SETTINGS.home.widgets.length)
  })

  it('applies a new default layout once, keeping hidden widgets hidden', () => {
    const migrated = migrateSettings({
      home: {
        widgets: [
          { id: 'vault', visible: true },
          { id: 'recent', visible: false },
        ],
        dailyDismissed: '',
      } as never,
    })
    expect(migrated.home.widgets.map((w) => w.id)).toEqual(DEFAULT_SETTINGS.home.widgets.map((w) => w.id))
    expect(migrated.home.widgets.find((w) => w.id === 'recent')?.visible).toBe(false)
    expect(migrated.home.layoutVersion).toBe(DEFAULT_SETTINGS.home.layoutVersion)
  })
})
