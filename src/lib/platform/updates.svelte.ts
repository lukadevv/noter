/**
 * Knowing when a newer Noter exists, on every platform it ships on.
 *
 * - Web: the service worker downloads new versions itself; this only offers
 *   the reload (see pwa.ts).
 * - Desktop installers (Windows .exe/.msi, macOS, Linux AppImage): the Tauri
 *   updater downloads the release, verifies its signature and installs it.
 * - Microsoft Store: the Store updates the app; nothing to do here.
 * - Linux .deb/.rpm and Android: the latest GitHub release is compared with
 *   this version, and a newer one is offered as a download.
 */
import { isCapacitor, isTauri } from './native'
import { compareVersions, pickAsset, type ReleaseAsset } from './semver'
import { theme } from '$lib/stores/theme.svelte'

const REPO = 'lukadevv/noter'
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const RELEASES = `https://github.com/${REPO}/releases/latest`
/** Automatic checks run at most this often. */
const CHECK_EVERY = 20 * 3_600_000

export type InstallKind = 'web' | 'store' | 'appimage' | 'system-package' | 'installer' | 'android'

export interface AvailableUpdate {
  version: string
  notes: string
  /** 'install' updates in place; 'download' opens a page; 'reload' swaps the web app. */
  mode: 'install' | 'download' | 'reload'
  url: string
}

type Status = 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error' | 'managed'

class Updates {
  status = $state<Status>('idle')
  available = $state<AvailableUpdate | null>(null)
  /** 0–1 while downloading. */
  progress = $state(0)
  error = $state('')
  kind = $state<InstallKind>('web')
  /** Hidden for this session by "Later". */
  dismissed = $state(false)

  #reloadWeb: (() => void) | null = null
  #pending: { downloadAndInstall: (cb: (event: DownloadEvent) => void) => Promise<void> } | null = null

  async detectKind(): Promise<InstallKind> {
    if (isCapacitor()) return (this.kind = 'android')
    if (!isTauri()) return (this.kind = 'web')
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      this.kind = await invoke<InstallKind>('install_kind')
    } catch {
      this.kind = 'installer'
    }
    return this.kind
  }

  /** Called by the service worker registration when a new web build is waiting. */
  offerWebReload(reload: () => void): void {
    this.#reloadWeb = reload
    this.available = { version: '', notes: '', mode: 'reload', url: '' }
    this.status = 'available'
    this.dismissed = false
  }

  /** The startup check: native only, at most once in CHECK_EVERY, and only if enabled. */
  async autoCheck(): Promise<void> {
    await theme.ready
    const settings = theme.settings.updates
    if (!settings.autoCheck || Date.now() - settings.lastCheck < CHECK_EVERY) return
    if ((await this.detectKind()) === 'web') return
    await this.check()
  }

  async check(): Promise<void> {
    if (this.status === 'checking' || this.status === 'downloading') return
    this.status = 'checking'
    this.error = ''
    const kind = await this.detectKind()
    theme.update({ updates: { ...theme.settings.updates, lastCheck: Date.now() } })
    try {
      if (kind === 'web') {
        // The service worker looks for new builds by itself; a manual check
        // asks it to look now.
        const registration = await navigator.serviceWorker?.getRegistration()
        await registration?.update()
        if (this.available?.mode !== 'reload') this.status = 'current'
        return
      }
      if (kind === 'store') {
        this.status = 'managed'
        return
      }
      if (kind === 'installer' || kind === 'appimage') {
        const installed = await this.#checkTauri()
        if (installed) return
        // Without a signing key in the build the updater cannot verify
        // anything; fall through to the release page so users still hear of it.
      }
      await this.#checkGitHub(kind)
    } catch (error) {
      this.status = 'error'
      this.error = error instanceof Error ? error.message : String(error)
    }
  }

  /** True when the updater answered (with or without an update). */
  async #checkTauri(): Promise<boolean> {
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (!update) {
        this.status = 'current'
        return true
      }
      this.#pending = update
      this.#offer({ version: update.version, notes: update.body ?? '', mode: 'install', url: RELEASES })
      return true
    } catch {
      return false
    }
  }

  async #checkGitHub(kind: InstallKind): Promise<void> {
    const response = await fetch(LATEST_API, { headers: { Accept: 'application/vnd.github+json' } })
    if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
    const release = (await response.json()) as {
      tag_name: string
      body?: string
      html_url: string
      assets: ReleaseAsset[]
    }
    if (compareVersions(release.tag_name, __APP_VERSION__) <= 0) {
      this.status = 'current'
      return
    }
    const asset = kind === 'android' ? pickAsset(release.assets, 'android') : null
    this.#offer({
      version: release.tag_name.replace(/^v/, ''),
      notes: release.body ?? '',
      mode: 'download',
      url: asset?.browser_download_url ?? release.html_url,
    })
  }

  #offer(update: AvailableUpdate): void {
    this.available = update
    this.status = 'available'
    this.dismissed = theme.settings.updates.skipped === update.version
  }

  /** "Update now": installs in place, downloads, or reloads, depending on the platform. */
  async apply(): Promise<void> {
    const update = this.available
    if (!update) return
    if (update.mode === 'reload') {
      this.#reloadWeb?.()
      return
    }
    if (update.mode === 'download') {
      await openExternal(update.url)
      return
    }
    if (!this.#pending) return
    this.status = 'downloading'
    this.progress = 0
    let total = 0
    let received = 0
    try {
      await this.#pending.downloadAndInstall((event) => {
        if (event.event === 'Started') total = event.data.contentLength ?? 0
        else if (event.event === 'Progress') {
          received += event.data.chunkLength
          this.progress = total ? Math.min(1, received / total) : 0
        } else this.progress = 1
      })
      this.status = 'ready'
    } catch (error) {
      this.status = 'error'
      this.error = error instanceof Error ? error.message : String(error)
    }
  }

  async restart(): Promise<void> {
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  }

  later(): void {
    this.dismissed = true
  }

  skip(): void {
    if (this.available)
      theme.update({ updates: { ...theme.settings.updates, skipped: this.available.version } })
    this.dismissed = true
  }
}

type DownloadEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished' }

async function openExternal(url: string): Promise<void> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_release_page', { url })
    return
  }
  window.open(url, '_blank', 'noopener')
}

export const updates = new Updates()
