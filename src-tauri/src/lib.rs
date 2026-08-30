use base64::{engine::general_purpose::STANDARD, Engine as _};

/// Writes an exported file to a path the user picked in the save dialog.
///
/// The webview has no download manager behind an `<a download>` link, so
/// exports come back over IPC instead. The bytes arrive base64-encoded: the IPC
/// payload is JSON, and a byte array would balloon a multi-megabyte archive into
/// several times its size on the way across.
///
/// Only a path the user chose is ever passed in, which is why no scope check
/// happens here — the dialog is the permission prompt.
#[tauri::command]
fn write_export(path: String, contents: String) -> Result<(), String> {
    let bytes = STANDARD
        .decode(contents)
        .map_err(|error| format!("The export could not be decoded: {error}"))?;
    std::fs::write(&path, bytes).map_err(|error| format!("{path} could not be written: {error}"))
}

/// Starts the window described by `tauri.conf.json`.
///
/// One setting there is worth explaining, since JSON cannot: `dragDropEnabled`
/// is false. Tauri otherwise intercepts dropped files itself and never lets the
/// events reach the page, which is where this app expects images to land.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![write_export])
        .run(tauri::generate_context!())
        .expect("Noter failed to start");
}
