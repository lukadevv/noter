import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android shell.
 *
 * `webDir` is the same `dist/` the website is deployed from — the Android build
 * is that folder loaded from local storage rather than the network, which is
 * why the app works offline without the service worker being involved.
 */
const config: CapacitorConfig = {
  appId: 'dev.lukadevv.noter',
  appName: 'Noter',
  webDir: 'dist',
  android: {
    // Matches the manifest's theme_color, so the splash and the status bar do
    // not flash white before the app paints.
    backgroundColor: '#16161a',
  },
}

export default config
