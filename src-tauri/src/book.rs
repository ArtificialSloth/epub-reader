use crate::{types::*, library};

use std::{io::BufReader, fs::{File}, time::SystemTime, time::Duration};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use epub::doc::EpubDoc;
use tauri::State;

fn prune_sources(library: &mut Library, identifier: &str, missing: &[String]) -> Result<bool, String> {
    if missing.is_empty() {
        return Ok(false);
    }
    if let Some(book) = library.get_mut(identifier) {
        if missing.len() < book.sources.len() {
            book.sources.retain(|path| !missing.contains(path));
            return Ok(true);
        }
    }
    Ok(false)
}

fn load_epub_doc(library_state: &mut LibraryState, identifier: &str) -> Result<(String, EpubDoc<BufReader<File>>), String> {
    let sources = library_state.library.get(identifier).ok_or_else(|| format!("no entry for {}", identifier))?.sources.clone();

    let mut resolved = Default::default();
    let mut missing = vec![];
    let doc = sources.iter().find_map(|path| {
        let doc = epub::doc::EpubDoc::new(path).ok();
        if doc.is_none() { missing.push(path.clone()); }
        resolved = path.clone();
        doc
    });

    if prune_sources(&mut library_state.library, identifier, &missing)? {
        library::save(library_state)?;
    }
    Ok((resolved, doc.ok_or_else(|| format!("no valid sources for {}", identifier))?))
}

#[tauri::command]
pub fn get_cover(state: State<'_, AppState>, identifier: String) -> Result<Option<String>, String> {
    let mut library_state = state.library_state.lock().unwrap();
    let (_, mut doc) = load_epub_doc(&mut library_state, &identifier)?;
    Ok(doc.get_cover().map(|(data, mime)| {
        format!("data:{};base64,{}", mime, STANDARD.encode(data))
    }))
}

#[tauri::command]
pub fn open_book(state: State<'_, AppState>, identifier: String) -> Result<Book, String> {
    let mut library_state = state.library_state.lock().unwrap();
    let (path, _) = load_epub_doc(&mut library_state, &identifier)?;

    let mut current_book = state.current_book.lock().unwrap();
    *current_book = Some(std::fs::read(path).map_err(|e| e.to_string())?);

    let book = library_state.library.get_mut(&identifier).ok_or_else(|| format!("no entry for {}", identifier))?;
    book.opened = SystemTime::duration_since(&SystemTime::now(), SystemTime::UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs();
    let book = book.clone();

    library::save(&mut library_state)?;
    Ok(book)
}

#[tauri::command]
pub fn close_book(state: State<'_, AppState>) -> Result<(), String> {    
    let mut library_state = state.library_state.lock().unwrap();
    let mut current_book = state.current_book.lock().unwrap();
    *current_book = None;

    library::save(&mut library_state)?;
    Ok(())
}

#[tauri::command]
pub fn save_progress(state: State<'_, AppState>, identifier: String, location: String) -> Result<Book, String> {
    let mut library_state = state.library_state.lock().unwrap();
    let book = library_state.library.get_mut(&identifier).ok_or_else(|| format!("no entry for {}", identifier))?;

    book.current_location = location;
    let book = book.clone();

    if library_state.last_save.elapsed() > Duration::from_secs(1) {
        library::save(&mut library_state)?;
    }
    Ok(book)
}
