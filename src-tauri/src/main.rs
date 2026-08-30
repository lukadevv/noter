// Without this the Windows release build opens a console window behind the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    noter_lib::run()
}
