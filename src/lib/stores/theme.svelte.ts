import { motion } from '$lib/ui/motion.svelte'
import { liveQuery, type Subscription } from 'dexie'
import { applyChrome, applyTokens } from '$lib/theme/apply'
import {
  DEFAULT_THEME_ID,
  PRESETS,
  PRESETS_BY_ID,
  presetTokens,
  systemPrefersDark,
} from '$lib/theme/presets'
import { deriveTokens, type ThemeSeed, type Tokens } from '$lib/theme/tokens'
import * as themesRepo from '$lib/db/repo/themes'
import type { Theme } from '$lib/db/schema'
import {
  DEFAULT_SETTINGS,
  loadSettings,
  readBootMirror,
  saveSettings,
  writeBootMirror,
  type AppSettings,
} from '$lib/db/repo/settings'
import { debounce } from '$lib/utils/debounce'

class ThemeStore {
  settings = $state<AppSettings>({ ...DEFAULT_SETTINGS })
  tokens = $state<Tokens>({})
  custom = $state<Theme[]>([])

  available: { id: string; name: string; builtin: boolean }[] = $derived([
    ...PRESETS.map((p) => ({ id: p.id, name: p.name, builtin: true })),
    ...this.custom.map((t) => ({ id: t.id, name: t.name, builtin: false })),
  ])

  #themeSub: Subscription | null = null

  #persist = debounce(() => {
    void saveSettings($state.snapshot(this.settings))
  }, 300)

  /**
   * Applies whatever the last session used, straight from localStorage, before
   * IndexedDB has opened. Without this the app paints with the fallback theme
   * and then visibly repaints.
   */
  bootFromMirror(): void {
    const mirror = readBootMirror()
    if (mirror) {
      this.tokens = mirror.tokens
      applyTokens(mirror.tokens)
      applyChrome({
        density: mirror.density,
        font: mirror.font,
        editorFontSize: DEFAULT_SETTINGS.editorFontSize,
        radiusScale: mirror.radiusScale,
      })
      return
    }
    this.applyThemeId(systemPrefersDark() ? 'dark' : 'light', false)
  }

  async load(): Promise<void> {
    this.settings = await loadSettings()
    this.#themeSub?.unsubscribe()
    this.#themeSub = liveQuery(() => themesRepo.allThemes()).subscribe((themes) => {
      this.custom = themes
      // A custom theme edited elsewhere should repaint this tab too.
      if (themes.some((t) => t.id === this.settings.themeId))
        this.applyThemeId(this.settings.themeId, false)
    })
    this.applyAll()
  }

  stop(): void {
    this.#themeSub?.unsubscribe()
    this.#themeSub = null
  }

  /** Tokens for any theme id, built-in or custom. */
  tokensFor(id: string): Tokens | null {
    const preset = presetTokens(id)
    if (preset) return preset
    return this.custom.find((t) => t.id === id)?.tokens ?? null
  }

  /** The editable seed behind a theme, used to open the theme editor. */
  seedFor(id: string): ThemeSeed | null {
    const preset = PRESETS_BY_ID.get(id)
    if (preset) return preset.seed
    const custom = this.custom.find((t) => t.id === id)
    return (custom?.seed as ThemeSeed | undefined) ?? null
  }

  /** Applies a seed without saving, so the editor can preview live. */
  preview(seed: ThemeSeed): void {
    const tokens = deriveTokens(seed)
    this.tokens = tokens
    applyTokens(tokens)
  }

  /** Drops any unsaved preview and repaints the active theme. */
  cancelPreview(): void {
    this.applyThemeId(this.settings.themeId, false)
  }

  async saveCustom(name: string, seed: ThemeSeed, id?: string): Promise<Theme> {
    const theme = await themesRepo.saveTheme({ id, name, seed })
    this.applyThemeId(theme.id)
    return theme
  }

  async deleteCustom(id: string): Promise<void> {
    await themesRepo.deleteTheme(id)
    if (this.settings.themeId === id) this.applyThemeId(DEFAULT_THEME_ID)
  }

  applyAll(): void {
    this.applyThemeId(this.settings.themeId, false)
    applyChrome({
      density: this.settings.density,
      font: this.settings.font,
      editorFontSize: this.settings.editorFontSize,
      radiusScale: this.settings.radiusScale,
    })
    motion.apply(this.settings.motion)
    this.saveMirror()
  }

  applyThemeId(id: string, persist = true): void {
    const tokens = this.tokensFor(id) ?? presetTokens(DEFAULT_THEME_ID)!
    this.tokens = tokens
    applyTokens(tokens)
    if (persist) {
      this.settings.themeId = id
      this.saveMirror()
      this.#persist()
    }
  }

  update(patch: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...patch }
    this.applyAll()
    this.#persist()
  }

  flush(): void {
    this.#persist.flush()
  }

  private saveMirror(): void {
    writeBootMirror({
      themeId: this.settings.themeId,
      density: this.settings.density,
      font: this.settings.font,
      radiusScale: this.settings.radiusScale,
      tokens: $state.snapshot(this.tokens),
    })
  }
}

export const theme = new ThemeStore()
