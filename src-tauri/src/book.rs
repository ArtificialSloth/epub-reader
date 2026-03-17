use crate::{types::*, library};

use std::{io::BufReader, fs::File, time::SystemTime, time::Duration};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use epub::doc::EpubDoc;
use tauri::State;

fn prune_sources(library: &mut Library, identifier: &str, missing: &[String]) -> Result<bool, String> {
    if missing.is_empty() {
        return Ok(false);
    }
    if let Some(book) = library.get_mut(identifier) {
        book.sources.retain(|path| !missing.contains(path));
        return Ok(true);
    }
    Ok(false)
}

fn load_epub_doc(library_state: &mut LibraryState, identifier: &str) -> Result<EpubDoc<BufReader<File>>, String> {
    let sources = library_state.library.get(identifier).ok_or_else(|| format!("No entry for {}", identifier))?.sources.clone();

    let mut missing = vec![];
    let doc = sources.iter().find_map(|path| {
        let doc = epub::doc::EpubDoc::new(path).ok();
        if doc.is_none() { missing.push(path.clone()); }
        doc
    });

    if prune_sources(&mut library_state.library, identifier, &missing)? {
        library::save(library_state)?;
    }
    Ok(doc.ok_or_else(|| format!("No valid sources for {}", identifier))?)
}

#[tauri::command]
pub fn get_cover(state: State<'_, AppState>, identifier: String) -> Result<Option<String>, String> {
    let mut library_state = state.library_state.lock().unwrap();
    let mut doc = load_epub_doc(&mut library_state, &identifier)?;
    Ok(doc.get_cover().map(|(data, mime)| {
        format!("data:{};base64,{}", mime, STANDARD.encode(data))
    }))
}

#[tauri::command]
pub fn open_book(state: State<'_, AppState>, identifier: String) -> Result<Book, String> {
    let mut library_state = state.library_state.lock().unwrap();
    let doc = load_epub_doc(&mut library_state, &identifier)?;

    let mut current_book = state.current_book.lock().unwrap();
    *current_book = Some(doc);

    let book = library_state.library.get_mut(&identifier).ok_or_else(|| format!("No entry for {}", identifier))?;
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
pub fn get_chapter(state: State<'_, AppState>, index: usize) -> Result<String, String> {
    let mut current_book = state.current_book.lock().unwrap();
    let doc = current_book.as_mut().ok_or_else(|| format!("No currently opened book"))?;
    
    doc.set_current_chapter(index);
    let data = doc.get_current_with_epub_uris().map_err(|e| e.to_string())?;
    
    Ok(String::from_utf8(data).map_err(|e| e.to_string())?)
}

#[tauri::command]
pub fn save_progress(state: State<'_, AppState>, identifier: String, chapter_index: usize, position_index: usize) -> Result<(), String> {
    let mut library_state = state.library_state.lock().unwrap();
    let book = library_state.library.get_mut(&identifier).ok_or_else(|| format!("No entry for {}", identifier))?;

    book.current_chapter = chapter_index;
    book.current_position = position_index;

    if library_state.last_save.elapsed() > Duration::from_secs(1) {
        library::save(&mut library_state)?;
    }
    Ok(())
}