use base64::{engine::general_purpose::STANDARD, Engine as _};

/// Writes an exported file to a path the user picked in the save dialog.
///
/// The webview has no download manager behind an `<a download>` link, so
/// exports come back over IPC instead. The bytes arrive base64-encoded: the IPC
/// payload is JSON, and a byte array would balloon a multi-megabyte archive into
/// several times its size on the way across.
///
/// Only a path the user chose is ever passed in, which is why no scope check
/// happens here - the dialog is the permission prompt.
#[tauri::command]
fn write_export(path: String, contents: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(contents)
        .map_err(|error| format!("The export could not be decoded: {error}"))?;
    std::fs::write(&path, bytes).map_err(|error| format!("{path} could not be written: {error}"))
}

/// How this copy of the app was installed, which decides how it updates.
///
/// - `store`: the Microsoft Store package (MSIX). The Store updates it; the app
///   must not try to replace its own files, which it cannot write anyway.
/// - `appimage`: a Linux AppImage, which the updater can replace in place.
/// - `system-package`: a Linux .deb or .rpm, owned by the package manager. The
///   app only says a new version exists and links to it.
/// - `installer`: the Windows installer (NSIS/MSI) or macOS app bundle, both of
///   which the updater can update.
#[tauri::command]
fn install_kind() -> &'static str {
    let exe = std::env::current_exe()
        .map(|path| path.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    if cfg!(target_os = "windows") && exe.contains("\\windowsapps\\") {
        "store"
    } else if cfg!(target_os = "linux") {
        if std::env::var_os("APPIMAGE").is_some() {
            "appimage"
        } else {
            "system-package"
        }
    } else {
        "installer"
    }
}

/// Shows a toast for the Microsoft Store (MSIX) build.
///
/// tauri-plugin-notification tags toasts with the bundle identifier, but a
/// packaged app only owns the AppUserModelID `<PackageFamilyName>!<AppId>`, and
/// Windows silently drops toasts sent under any other id. The family name is
/// read from the install folder, `WindowsApps\<Name>_<version>_<arch>__<publisherId>`.
#[tauri::command]
fn store_notify(title: String, body: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let exe = std::env::current_exe().map_err(|error| error.to_string())?;
        let folder = exe
            .parent()
            .and_then(|dir| dir.file_name())
            .map(|name| name.to_string_lossy().into_owned())
            .unwrap_or_default();
        let mut parts = folder.split('_');
        let (name, publisher) = (parts.next(), parts.last());
        let (Some(name), Some(publisher)) = (name, publisher) else {
            return Err("Not running from an MSIX install folder.".into());
        };
        let aumid = format!("{name}_{publisher}!Noter");
        tauri_winrt_notification::Toast::new(&aumid)
            .title(&title)
            .text1(&body)
            .show()
            .map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (title, body);
        Err("Only available on Windows.".into())
    }
}

/// Opens a release page in the system browser, for installs the app cannot
/// update itself (Linux .deb/.rpm). Only this project's GitHub pages are
/// accepted, so the webview cannot be used to launch arbitrary programs.
#[tauri::command]
fn open_release_page(url: String) -> Result<(), String> {
    if !url.starts_with("https://github.com/lukadevv/noter/") {
        return Err("Only Noter's release pages can be opened.".into());
    }
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer").arg(&url).spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&url).spawn();
    result.map(|_| ()).map_err(|error| error.to_string())
}

/// Starts the window described by `tauri.conf.json`.
///
/// One setting there is worth explaining, since JSON cannot: `dragDropEnabled`
/// is false. Tauri otherwise intercepts dropped files itself and never lets the
/// events reach the page, which is where this app expects images to land.
///
/// `additionalBrowserArgs` (Windows) turns off WebView2's background timer
/// throttling, so a timer still rings on time while the window is minimised
/// or covered. Setting it replaces Tauri's own defaults, which is why the
/// first `--disable-features` flag repeats them.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Timer and medication reminders are shown as system notifications.
        .plugin(tauri_plugin_notification::init());

    // In-app updates: the updater checks the latest GitHub release's
    // `latest.json` and verifies the download against the public key baked
    // into tauri.conf.json at build time; `process` restarts into the new
    // version.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init());

    builder
        .invoke_handler(tauri::generate_handler![write_export, install_kind, open_release_page, store_notify])
        .run(tauri::generate_context!())
        .expect("Noter failed to start");
}
