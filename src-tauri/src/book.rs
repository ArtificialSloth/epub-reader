use crate::{types::*, library};

use std::{io::BufReader, fs::File, time::Instant};
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

fn load_epub_doc(sources: &[String]) -> (Option<EpubDoc<BufReader<File>>>, Vec<String>) {
    let mut missing: Vec<String> = vec![];
    let doc = sources.iter().find_map(|path| {
        let doc = epub::doc::EpubDoc::new(path).ok();
        if doc.is_none() { missing.push(path.clone()); }
        doc
    });
    (doc, missing)
}

#[tauri::command]
pub fn get_cover(state: State<'_, AppState>, identifier: String) -> Result<Option<String>, String> {
    let mut library = state.library.lock().unwrap();
    let sources = library.get(&identifier).ok_or_else(|| format!("No entry for {}", identifier))?.sources.clone();
    let (doc, missing) = load_epub_doc(&sources);
    let mut doc = doc.ok_or_else(|| format!("No valid sources for {}", identifier))?;
    
    if prune_sources(&mut library, &identifier, &missing)? {
        library::save(&library)?;
        let mut last_save = state.last_save.lock().unwrap();
        *last_save = Instant::now();
    }

    Ok(doc.get_cover().map(|(data, mime)| {
        format!("data:{};base64,{}", mime, STANDARD.encode(data))
    }))
}