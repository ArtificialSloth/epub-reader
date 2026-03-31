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
    
    #[tauri::command]
    fn get_custom_styles() -> Result<String, String> {
        let path = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .parent()
            .map(|p| p.join("styles.css"))
            .ok_or_else(|| String::from("could not resolve exe directory"))?;
        match std::fs::read_to_string(path) {
            Ok(s) => Ok(s),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
            Err(e) => Err(e.to_string()),
        }
    }

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
        .plugin(tauri_plugin_cli::init())
        .invoke_handler(tauri::generate_handler![
            get_custom_styles,
            library::get_library,
            library::remove_book,
            library::add_book,
            book::get_cover,
            book::open_book,
            book::close_book,
            book::save_progress,
        ])
        .build(tauri::generate_context!())
        .expect("error while building application")
        .run(|app_handle, event| match event {
            tauri::RunEvent::Exit {} => {
                let state = app_handle.state::<AppState>();
                let mut library_state = state.library_state.lock().unwrap();
                library::save(&mut library_state).expect("error while saving library");
            }
            _ => {}
        });
}
