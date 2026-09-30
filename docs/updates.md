# Updates

Each build of Noter finds out about new versions in the way that fits how it
was installed.

| Installed from                                           | What happens                                                                                               |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| The website (PWA)                                        | The service worker downloads the new build; a banner offers to reload.                                     |
| Windows `.exe` / `.msi`, macOS `.dmg`, Linux `.AppImage` | The Tauri updater downloads the release, checks its signature and installs it; a banner offers to restart. |
| Microsoft Store                                          | The Store updates the app. Noter does nothing.                                                             |
| Linux `.deb` / `.rpm`                                    | Noter compares its version with the latest GitHub release and links to the release page.                   |
| Android `.apk`                                           | Same, linking straight to the new `.apk`.                                                                  |

Native builds check when they start, at most once a day (it can be turned off in
_Settings → About_, which also has a "Check for updates" button).

## Turning on in-app updates for the desktop builds

The updater only installs files signed with a key whose public half is built
into the app. This is **not** a code-signing certificate and costs nothing.

1. Generate the key pair once, on your machine:

   ```sh
   pnpm tauri signer generate -w ~/.tauri/noter.key
   ```

   Keep the private key and its password somewhere safe: every future update
   must be signed with it. Losing it means users have to reinstall by hand once.

2. In GitHub, _Settings → Secrets and variables → Actions_:
   - **Secrets:** `TAURI_SIGNING_PRIVATE_KEY` (the contents of `noter.key`) and
     `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.
   - **Variables:** `TAURI_UPDATER_PUBKEY` (the contents of `noter.key.pub`).

3. Cut a release as usual. The _Release_ workflow then also uploads the signed
   update bundles and a `latest.json`, which installed copies read from
   `https://github.com/lukadevv/noter/releases/latest/download/latest.json`.

Without these three values the release builds exactly as before; installed
copies then fall back to "a new version is out" with a link to the release page.

Only versions built **after** the key is configured can update themselves: the
first release with the key has to be installed by hand once.
