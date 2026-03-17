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
        .register_uri_scheme_protocol("epub", |ctx, request| {
            let state = ctx.app_handle().state::<AppState>();
            let mut current_book = state.current_book.lock().unwrap();
            let Some(doc) = current_book.as_mut() else {
                return http::Response::builder().status(404).body(vec![]).unwrap();
            };

            let uri = request.uri().to_string();
            let path = uri.trim_start_matches("epub://");
            let data = doc.get_resource_by_path(path);
            let mime = doc.get_resource_mime_by_path(path);
            
            data.zip(mime)
                .map(|(data, mime)| {
                    http::Response::builder()
                        .header("Content-Type", mime)
                        .body(data)
                        .unwrap()
                })
                .unwrap_or_else(|| http::Response::builder().status(404).body(vec![]).unwrap())
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
            book::get_chapter,
            book::save_progress,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
