mod types;
mod library;
mod book;

use crate::types::*;
use std::{time::Instant, sync::Mutex};
use tauri::{Manager, http};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let library_state = LibraryState {
        library: library::load().unwrap_or_default(),
        last_save: Instant::now(),
    };
    
    tauri::Builder::default()
        .manage(AppState {
            library_state: Mutex::new(library_state),
            current_book: Mutex::new(None),
        })
        .register_uri_scheme_protocol("epub", |ctx, _request| { 
            let state = ctx.app_handle().state::<AppState>();
            let current_book = state.current_book.lock().unwrap();
            match current_book.as_ref() {
                Some(data) => http::Response::builder()
                    .header("Content-Type", "application/epub+zip")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(data.clone())
                    .unwrap(),
                None => http::Response::builder()
                            .status(404)
                            .header("Access-Control-Allow-Origin", "*")
                            .body(vec![])
                            .unwrap(),
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            library::get_library,
            library::remove_book,
            library::add_book,
            book::get_cover,
            book::open_book,
            book::close_book,
            book::save_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
