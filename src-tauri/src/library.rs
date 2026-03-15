use crate::types::*;

use std::{time::SystemTime, time::Instant};
use tauri::State;

fn get_path() -> std::path::PathBuf {
    std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .join("library.json")
}

pub fn load() -> Result<Library, String> {
    let path = get_path();

    let content = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Library::new()),
        Err(e) => return Err(e.to_string()),
    };

    let library = serde_json::from_str::<Library>(&content).map_err(|e| e.to_string())?;
    Ok(library)
}

pub fn save(library: &Library) -> Result<(), String> {
    let path = get_path();
    let content = serde_json::to_string_pretty(&library).map_err(|e| e.to_string())?;

    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_library(state: State<'_, AppState>) -> Result<Library, String> {
    let library = state.library.lock().unwrap();
    Ok(library.clone())
}

#[tauri::command]
pub fn add_book(state: State<'_, AppState>, path: String) -> Result<Book, String> {
    let doc = epub::doc::EpubDoc::new(&path).map_err(|e| e.to_string())?;
    let now = SystemTime::duration_since(&SystemTime::now(), SystemTime::UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs();

    let title = doc
        .mdata("title")
        .map(|m| m.value.clone())
        .unwrap_or_default();
    let author = doc
        .mdata("creator")
        .map(|m| m.value.clone())
        .unwrap_or_default();
    let identifier = doc
        .mdata("identifier")
        .map(|m| m.value.clone())
        .unwrap_or_else(|| format!("{}:{}", title, author));

    let mut library = state.library.lock().unwrap();
    let book = library.entry(identifier)
        .and_modify(|b| {
            if !b.sources.contains(&path) {
                b.sources.push(path.clone());
            }
            b.opened = now
        })
        .or_insert(Book {
            title,
            author,
            sources: vec![path],
            added: now,
            opened: now,
            num_chapters: doc.get_num_chapters(),
            current_chapter: 0,
            scroll_position: 0.0,
        })
        .clone();

    save(&library)?;
    let mut last_save = state.last_save.lock().unwrap();
    *last_save = Instant::now();
    
    Ok(book)
}

#[tauri::command]
pub fn remove_book(state: State<'_, AppState>, identifier: String) -> Result<Option<Book>, String> {
    let mut library = state.library.lock().unwrap();
    let book = library.remove(&identifier);
    
    save(&library)?;
    let mut last_save = state.last_save.lock().unwrap();
    *last_save = Instant::now();
    
    Ok(book)
}