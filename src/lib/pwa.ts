/**
 * Service worker registration.
 *
 * Updates are prompted rather than applied silently: swapping the running app
 * out from under someone mid-edit is exactly the moment to not be clever.
 */
export function registerServiceWorker(): void {
  if (import.meta.env.DEV) return

  void import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      onNeedRefresh() {
        // Deferred to the toast system once the store is reachable from here;
        // a confirm keeps the behaviour honest until then.
        if (confirm('A new version of Noter is ready. Reload now?')) void updateSW(true)
      },
    })
  })
}
