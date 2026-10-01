/**
 * System notifications for reminders, on every platform the app ships on.
 *
 * Same shape as save-file.ts: one function per operation, each native SDK
 * loaded with a dynamic import so none of it reaches the initial bundle.
 *
 * What each platform can promise differs, and the UI says so:
 *  - Web: shows notifications while the app is open (even in a background
 *    tab). Once the tab is closed nothing can fire.
 *  - Desktop (Tauri): same, while the app runs; the window may be minimised.
 *  - Android (Capacitor): scheduled with the OS, so reminders fire even when
 *    the app is closed.
 */
import { isCapacitor, isTauri } from './native'

export type Permission = 'granted' | 'denied' | 'prompt' | 'unsupported'

export interface Reminder {
  /** Stable id of the thing being reminded about (a timer, a dose). */
  id: string
  title: string
  body: string
}

/** Android notification ids are Java ints; derive a stable one from the uuid. */
export function nativeId(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (Math.imul(31, hash) + id.charCodeAt(i)) | 0
  return Math.abs(hash) % 2_000_000_000
}

export async function permission(): Promise<Permission> {
  if (isTauri()) {
    const { isPermissionGranted } = await import('@tauri-apps/plugin-notification')
    return (await isPermissionGranted()) ? 'granted' : 'prompt'
  }
  if (isCapacitor()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { display } = await LocalNotifications.checkPermissions()
    return display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'prompt'
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission === 'default' ? 'prompt' : Notification.permission
}

/** Asks for permission. Must be called from a user gesture (a click). */
export async function requestPermission(): Promise<Permission> {
  if (isTauri()) {
    const { requestPermission: ask } = await import('@tauri-apps/plugin-notification')
    return (await ask()) === 'granted' ? 'granted' : 'denied'
  }
  if (isCapacitor()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const { display } = await LocalNotifications.requestPermissions()
    return display === 'granted' ? 'granted' : 'denied'
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  const result = await Notification.requestPermission()
  return result === 'default' ? 'prompt' : result
}

/** Shows a notification now. Silent failure: the in-app alarm is the fallback. */
export async function notify(reminder: Reminder): Promise<void> {
  try {
    if ((await permission()) !== 'granted') return
    if (isTauri()) {
      // The Store build needs its own package id on the toast, see store_notify.
      const { invoke } = await import('@tauri-apps/api/core')
      if ((await invoke<string>('install_kind')) === 'store') {
        await invoke('store_notify', { title: reminder.title, body: reminder.body })
        return
      }
      const { sendNotification } = await import('@tauri-apps/plugin-notification')
      sendNotification({ title: reminder.title, body: reminder.body })
      return
    }
    if (isCapacitor()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.schedule({
        notifications: [{ id: nativeId(reminder.id), title: reminder.title, body: reminder.body }],
      })
      return
    }
    // A service worker notification works on Android Chrome, where the
    // Notification constructor throws, and survives the tab being in the background.
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(reminder.title, {
        body: reminder.body,
        tag: reminder.id,
        icon: '/icons/icon-192.png',
        badge: '/icons/favicon-32.png',
        data: { id: reminder.id },
      })
    } else {
      new Notification(reminder.title, {
        body: reminder.body,
        tag: reminder.id,
        icon: '/icons/icon-192.png',
      })
    }
  } catch {
    // The alarm sound and the in-app dialog still happen.
  }
}

/** True where reminders can be handed to the OS and fire with the app closed. */
export function canSchedule(): boolean {
  return isCapacitor()
}

/**
 * Hands a future reminder to the OS (Android). Elsewhere this is a no-op: the
 * in-app scheduler fires it while the app is open.
 */
export async function schedule(reminder: Reminder & { at: number }): Promise<void> {
  if (!isCapacitor() || reminder.at <= Date.now()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return
    await LocalNotifications.schedule({
      notifications: [
        {
          id: nativeId(reminder.id),
          title: reminder.title,
          body: reminder.body,
          schedule: { at: new Date(reminder.at), allowWhileIdle: true },
        },
      ],
    })
  } catch {
    // Exact alarms may be refused on Android 14+; the in-app timer still works.
  }
}

export async function cancel(id: string): Promise<void> {
  if (!isCapacitor()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: nativeId(id) }] })
  } catch {
    // Nothing scheduled, nothing to cancel.
  }
}
