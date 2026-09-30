# Publishing Noter on the Microsoft Store

Noter ships to the Store as an **MSIX** package. Microsoft signs MSIX packages
for free, so no code-signing certificate is needed (the EXE/MSI route requires
one).

The first submission asks for the package file on its **Packages** step, before
any release exists. The **MSIX** workflow builds that file on demand, so the
order is: reserve the name → copy the identity into the repo → run the workflow
→ upload its file.

## 1. Create the product in Partner Center

1. In **Apps and games → New product**, choose **"MSIX or PWA app"**. The product
   type cannot be changed later.
2. If the name "Noter" is already reserved by an "EXE or MSI app" product,
   delete that product (or release the name under _Product management → Manage
   app names_) and reserve it again in the new one.

## 2. Store the package identity in the repository

Reserving the name is enough for Partner Center to assign the identity; no
package upload is needed to see it. Open **Product management → Product
identity**, copy these three values and save them as **repository variables**
in GitHub (_Settings → Secrets and variables → Actions → Variables_):

| Partner Center                            | GitHub variable               |
| ----------------------------------------- | ----------------------------- |
| `Package/Identity/Name`                   | `MSIX_IDENTITY_NAME`          |
| `Package/Identity/Publisher` (`CN=…`)     | `MSIX_PUBLISHER`              |
| `Package/Properties/PublisherDisplayName` | `MSIX_PUBLISHER_DISPLAY_NAME` |

Copy them exactly: Partner Center rejects a package whose identity differs by a
single character.

## 3. Build the package

- **Without a release (first submission, or any time):** in GitHub, go to
  _Actions → MSIX → Run workflow_. When it finishes, download the
  **`noter-msix`** artifact from the run's summary page and unzip it; inside is
  `Noter_X.Y.Z.0_x64.msix`. The workflow also runs on pull requests that touch
  the MSIX packaging.
- **With a release:** pushing a `vX.Y.Z` tag runs the _Release_ workflow, which
  also attaches the `.msix` to the GitHub release.
- **Locally (Windows):** `pnpm desktop:build`, then
  `pwsh scripts/build-msix.ps1` with the three variables set in the
  environment.

The package is unsigned on purpose: it is only for uploading to the Store, which
signs it. An unsigned MSIX cannot be installed by double-clicking it.

The version comes from `package.json` (`1.0.0` becomes `1.0.0.0`). Every upload
must have a higher version than the last package the Store accepted, so bump
`version` in `package.json` before building an update.

## 4. Complete the submission

- **Pricing and availability:** free, all markets.
- **Properties:** categories, privacy policy URL and system requirements
  (below).
- **Age ratings:** the IARC questionnaire. Noter is a utility with no
  user-to-user communication, no purchases and no publicly shared user content.
- **Packages:** upload the `.msix` from step 3.
- **Store listings:** description, at least one screenshot (1366×768 or larger)
  and the logo (`assets/logo-1024.png`, transparent background).
- **Submission options → Notes for certification:** the text below.

### Categories

- **Primary:** Productivity
- **Secondary (optional):** Utilities & tools

### Privacy policy URL

`https://noter.lukadevv.com/privacy.html`

### System requirements

- **Minimum hardware:** leave everything unticked, so the app can be installed
  on touch-only devices.
- **Recommended hardware:** Keyboard and Mouse.
- **Memory:** minimum 2 GB, recommended 4 GB.
- **DirectX / Video memory:** not required.
- **Architecture:** x64.
- **OS:** Windows 10 version 1809 (build 17763) or later. This comes from the
  manifest; there is nothing to enter.

### Notes for certification

> Noter is a local-first notes app built with Tauri 2 (a Win32 app packaged as MSIX). No account or sign-in is required and no test credentials are needed; all data is stored locally on the device and the app works fully offline. The network is used only when the user pastes an image URL, to download that image.
>
> To test:
>
> 1. Notes: create a note and type "/" to insert blocks (checklist, board, gallery, code).
> 2. Timers: tap a preset; a synthesized sound and a local notification play when it ends.
> 3. Medication: add a medication and press "Taken".
> 4. Vault: set any master password to store encrypted entries.
>
> Notifications are local only and require user permission. The app requires the Microsoft Edge WebView2 Runtime, which is included in Windows 11 and in up-to-date Windows 10. The runFullTrust capability is required because this is a desktop (Win32) application. There are no ads, no in-app purchases and no data collection.

## 5. Automatic submissions on every release

After the first submission has passed certification, the _Release_ workflow can
send each new version to the Store by itself: its **Microsoft Store** job
downloads the `.msix` from the GitHub release and creates and commits a new
submission with it. Store listing, screenshots and pricing carry over from the
previous submission.

It needs a Partner Center API client:

1. In Partner Center, open **Account settings → User management → Microsoft
   Entra applications** and associate your Microsoft Entra ID (Azure AD)
   tenant if it is not already.
2. **Create Microsoft Entra application** (or add an existing one) and give it
   the **Manager** role. Open it and **Add new key**: copy the client secret
   right away, it is shown once.
3. Note the **Tenant ID**, **Client ID** and the **Seller ID** (_Account settings
   → Legal info → Developer_), and the app's **Store ID** (_Product identity_,
   e.g. `9NXXXXXXXXXX`).
4. In GitHub, _Settings → Secrets and variables → Actions_:

   | Where    | Name                     | Value               |
   | -------- | ------------------------ | ------------------- |
   | Secret   | `MS_STORE_TENANT_ID`     | Tenant ID           |
   | Secret   | `MS_STORE_CLIENT_ID`     | Client ID           |
   | Secret   | `MS_STORE_CLIENT_SECRET` | Client secret       |
   | Secret   | `MS_STORE_SELLER_ID`     | Seller ID           |
   | Variable | `MS_STORE_PRODUCT_ID`    | Store ID of the app |

Without them the job logs a notice and skips; the `.msix` on the release can
still be uploaded by hand. A submission that is already in progress in Partner
Center blocks a new one, so finish or delete a draft there before tagging.

The Store copy never updates itself: `install_kind` in `src-tauri/src/lib.rs`
detects the MSIX install and the app leaves updating to the Store.

## 6. Troubleshooting

- **"The package identity doesn't match" / "Invalid package family name":** one
  of the three repository variables differs from _Product identity_. Fix it and
  run the workflow again.
- **"A package with this version already exists" (or a lower one):** bump
  `version` in `package.json` and rebuild.
- **The MSIX workflow fails at "Check the Partner Center identity":** the
  repository variables are not set yet (step 2).

## 7. Tell users of the .exe

The Store version keeps its data in a different location from the version
installed with the `.exe`/`.msi`. To move over: in the old version, go to
_Settings → Backups → Export .noter backup_; in the new one, use _Import .noter
backup_.
