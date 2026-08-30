/**
 * Tells the web build apart from the two native shells it also ships in.
 *
 * Both shells run the very same `dist/` folder inside a system webview, so the
 * app cannot assume the browser it was written for: the desktop build runs on
 * WebView2, WebKitGTK or WKWebView depending on the platform, and the Android
 * build runs on the system WebView. Detection is done against globals the
 * shells inject rather than a build-time flag, so one artefact keeps behaving
 * correctly wherever it is loaded from.
 */

interface CapacitorBridge {
  isNativePlatform?: () => boolean
  getPlatform?: () => string
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    Capacitor?: CapacitorBridge
  }
}

/** True inside the desktop shell (Windows, macOS, Linux). */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && window.__TAURI_INTERNALS__ !== undefined
}

/** True inside the Android shell. */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true
}

/** True in either shell, false in a plain browser tab. */
export function isNative(): boolean {
  return isTauri() || isCapacitor()
}
