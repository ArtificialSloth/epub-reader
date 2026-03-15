mod types;
mod library;
mod book;

use crate::types::*;
use std::{time::Instant, sync::Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let library = library::load().unwrap_or_default();
    tauri::Builder::default()
        .manage(AppState {
            library: Mutex::new(library),
            last_save: Mutex::new(Instant::now()),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            library::get_library,
            library::remove_book,
            library::add_book,
            book::get_cover
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
