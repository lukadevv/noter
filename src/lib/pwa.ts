/**
 * Service worker registration.
 *
 * Updates are offered rather than applied silently: swapping the running app
 * out from under someone mid-edit is exactly the moment to not be clever. The
 * offer is the same corner banner the native builds use.
 */
import { isNative } from '$lib/platform/native'

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return
  // The native shells already carry the whole app on disk. A service worker
  // there would only add a second, staler copy that outlives the installer.
  if (isNative()) return

  void import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        void import('$lib/platform/updates.svelte').then(({ updates }) =>
          updates.offerWebReload(() => void updateSW(true)),
        )
      },
    })
  })
}
