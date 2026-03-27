use crate::types::*;

use std::{time::SystemTime, time::Instant};
use tauri::State;

fn get_path() -> Result<std::path::PathBuf, String> {
    std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("library.json"))
        .ok_or_else(|| String::from("could not resolve exe directory"))
}

pub fn load() -> Result<Library, String> {
    let path = get_path()?;

    let content = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Library::new()),
        Err(e) => return Err(e.to_string()),
    };

    let library = serde_json::from_str::<Library>(&content).map_err(|e| e.to_string())?;
    Ok(library)
}

pub fn save(library_state: &mut LibraryState) -> Result<(), String> {
    let path = get_path()?;
    let content = serde_json::to_string_pretty(&library_state.library).map_err(|e| e.to_string())?;

    std::fs::write(path, content).map_err(|e| e.to_string())?;
    library_state.last_save = Instant::now();
    Ok(())
}

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> Result<Library, String> {
    let library = state.library_state.lock().unwrap().library.clone();
    Ok(library)
}

#[tauri::command]
pub fn add_book(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let doc = epub::doc::EpubDoc::new(&path).map_err(|e| e.to_string())?;
    let now = SystemTime::duration_since(&SystemTime::now(), SystemTime::UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs();

    let title = doc.get_title()
        .unwrap_or_default();
    let author = doc.mdata("creator")
        .map(|m| m.value.clone())
        .unwrap_or_default();
    let identifier = doc.mdata("identifier")
        .map(|m| m.value.clone())
        .unwrap_or_else(|| format!("{}:{}", title, author));

    let mut library_state = state.library_state.lock().unwrap();
    library_state.library.entry(identifier.clone())
        .and_modify(|b| {
            if !b.sources.contains(&path) {
                b.sources.push(path.clone());
            }
        })
        .or_insert(Book {
            title,
            author,
            sources: vec![path.clone()],
            added: now,
            opened: now,
            ..Default::default()
        });

    save(&mut library_state)?;    
    Ok(identifier)
}

#[tauri::command]
pub fn remove_book(state: State<'_, AppState>, identifier: String) -> Result<Option<Book>, String> {
    let mut library_state = state.library_state.lock().unwrap();
    let book = library_state.library.remove(&identifier);
    
    save(&mut library_state)?;
    Ok(book)
}
