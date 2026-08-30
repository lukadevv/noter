/**
 * Service worker registration.
 *
 * Updates are prompted rather than applied silently: swapping the running app
 * out from under someone mid-edit is exactly the moment to not be clever.
 */
import { t } from '$lib/i18n/index.svelte'
import { isNative } from '$lib/platform/native'

export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return
  // The native shells already carry the whole app on disk. A service worker
  // there would only add a second, staler copy that outlives the installer.
  if (isNative()) return

  void import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // Deferred to the toast system once the store is reachable from here;
        // a confirm keeps the behaviour honest until then.
        if (confirm(t('update.ready'))) void updateSW(true)
      },
    })
  })
}
