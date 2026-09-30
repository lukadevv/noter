# Publicar Noter en Microsoft Store

Noter se publica en la Store como **MSIX**. Con MSIX, Microsoft firma el
paquete gratis, así que no hace falta comprar un certificado de firma de código
(el camino EXE/MSI sí lo exige).

## 1. Crear el producto en Partner Center

1. En **Apps and games → New product**, elegí **"MSIX or PWA app"**. El tipo de
   producto no se puede cambiar después.
2. Si el nombre "Noter" quedó reservado en un producto "EXE or MSI app", borrá
   ese producto (o liberá el nombre en _Product management → Manage app names_)
   y reservalo en el nuevo.

## 2. Conectar la identidad del paquete con el repo

En **Product management → Product identity** copiá estos tres valores y
guardalos como **repository variables** en GitHub
(_Settings → Secrets and variables → Actions → Variables_):

| Partner Center                            | Variable de GitHub            |
| ----------------------------------------- | ----------------------------- |
| `Package/Identity/Name`                   | `MSIX_IDENTITY_NAME`          |
| `Package/Identity/Publisher` (`CN=…`)     | `MSIX_PUBLISHER`              |
| `Package/Properties/PublisherDisplayName` | `MSIX_PUBLISHER_DISPLAY_NAME` |

## 3. Generar el paquete

Al pushear un tag `vX.Y.Z` (o correr el workflow _Release_ a mano), el job de
Windows arma el `.exe`, el `.msi` y además `Noter_X.Y.Z.0_x64.msix`, y lo sube al
release de GitHub. El paquete no está firmado: sirve solo para subirlo a la
Store, que lo firma. Localmente: `pnpm desktop:build` y después
`pwsh scripts/build-msix.ps1` con las tres variables definidas.

## 4. Completar la submission

- **Pricing and availability:** gratis, todos los mercados.
- **Properties:** categorías, URL de privacidad y requisitos (abajo).
- **Age ratings:** cuestionario IARC. Es una utilidad, sin chat entre usuarios,
  sin compras y sin contenido generado compartido públicamente.
- **Packages:** subí el `.msix`.
- **Store listings:** descripción, al menos una captura (1366×768 o más) y el
  logo (`assets/logo-1024.png`, con fondo transparente).
- **Submission options → Notes for certification:** el texto de abajo.

### Categorías

- **Principal:** Productivity
- **Secundaria (opcional):** Utilities & tools

### Privacy policy URL

`https://noter.lukadevv.com/privacy.html`

### System requirements

- **Minimum hardware:** no marcar nada, así la app se puede instalar en equipos
  solo táctiles.
- **Recommended hardware:** Keyboard y Mouse.
- **Memory:** mínimo 2 GB, recomendado 4 GB.
- **DirectX / Video memory:** no requeridos.
- **Architecture:** x64.
- **OS:** Windows 10 versión 1809 (build 17763) o posterior. Sale del manifest,
  no hace falta cargarlo a mano.

### Notes for certification

(En inglés, porque lo leen los testers.)

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

## 5. Avisar a los usuarios del .exe

La versión de la Store guarda sus datos en otra ubicación que la instalada con
el `.exe`/`.msi`. Para pasar de una a otra: en la versión vieja,
_Ajustes → Copias de seguridad → Exportar copia .noter_; en la nueva,
_Importar copia .noter_.
