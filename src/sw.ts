/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})

// Clicking a reminder brings the app forward (or opens it) on the relevant section.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const open = windows[0]
      if (open) {
        await open.focus()
        return
      }
      await self.clients.openWindow('/#/')
    })(),
  )
})

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
clientsClaim()
