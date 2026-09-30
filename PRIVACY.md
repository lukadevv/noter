# Privacy policy

The published version lives at <https://noter.lukadevv.com/privacy.html>
(source: [`public/privacy.html`](public/privacy.html), in English and Spanish).

**In short:** Noter keeps everything on your device. There is no account and no
Noter server, and the desktop and Android apps send no analytics or telemetry.

- Notes, folders, images, timers, medication entries and settings are stored
  locally (IndexedDB in the app's web view, or in your browser on the web).
- Vault entries and encrypted folders are encrypted on the device with
  AES-256-GCM, with a key derived from a password that is never stored.
- The network is used only to download images whose address you paste, and,
  on the web version only, for cookieless Cloudflare Web Analytics when the
  deployment enables it.
- Share links carry the note after `#` in the address, which browsers never
  send to a server.
- Reminders are scheduled and shown by your own device, after you allow
  notifications.
- Uninstalling the app (or clearing the site's data) removes everything.

Questions: <https://github.com/lukadevv/noter/issues>.
