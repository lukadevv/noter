// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapacitor, isNative, isTauri } from '$lib/platform/native'
import { saveFile } from '$lib/platform/save-file'

afterEach(() => {
  delete window.__TAURI_INTERNALS__
  delete window.Capacitor
  vi.restoreAllMocks()
})

describe('shell detection', () => {
  it('reports a plain browser tab as not native', () => {
    expect(isTauri()).toBe(false)
    expect(isCapacitor()).toBe(false)
    expect(isNative()).toBe(false)
  })

  it('recognises the desktop shell by the bridge it injects', () => {
    window.__TAURI_INTERNALS__ = {}
    expect(isTauri()).toBe(true)
    expect(isNative()).toBe(true)
  })

  // The global exists in a Capacitor web build too, where it answers false;
  // only the answer, never the presence, may be taken as the signal.
  it('recognises Android only when the bridge says it is native', () => {
    window.Capacitor = { isNativePlatform: () => false }
    expect(isCapacitor()).toBe(false)

    window.Capacitor = { isNativePlatform: () => true }
    expect(isCapacitor()).toBe(true)
    expect(isNative()).toBe(true)
  })
})

describe('saving a file in a browser', () => {
  it('goes out through a download link', async () => {
    // jsdom implements neither object URLs nor navigation.
    const createObjectURL = vi.fn(() => 'blob:noter/1')
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await saveFile(new Blob(['# note'], { type: 'text/markdown' }), 'note.md')

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    const link = click.mock.instances[0] as unknown as HTMLAnchorElement
    expect(link.download).toBe('note.md')
    expect(link.href).toBe('blob:noter/1')
  })
})
