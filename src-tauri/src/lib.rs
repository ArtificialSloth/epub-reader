use std::{collections::HashMap, io::BufReader, fs::File, time::SystemTime, time::Instant, sync::Mutex};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use epub::doc::EpubDoc;
use tauri::State;

type Library = HashMap<String, Book>;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
struct Book {
    title: String,
    author: String,
    sources: Vec<String>,
    added: u64,
    opened: u64,
    num_chapters: usize,
    current_chapter: usize,
    scroll_position: f64,
}

struct AppState {
    library: Mutex<Library>,
    last_save: Mutex<std::time::Instant>,
}

fn get_library_path() -> std::path::PathBuf {
    std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .join("library.json")
}

fn load_library() -> Result<Library, String> {
    let path = get_library_path();

    let content = match std::fs::read_to_string(path) {
        Ok(s) => s,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Library::new()),
        Err(e) => return Err(e.to_string()),
    };

    let library = serde_json::from_str::<Library>(&content).map_err(|e| e.to_string())?;
    Ok(library)
}

fn save_library(library: &Library) -> Result<(), String> {
    let path = get_library_path();
    let content = serde_json::to_string_pretty(&library).map_err(|e| e.to_string())?;

    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

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
fn get_library(state: State<'_, AppState>) -> Result<Library, String> {
    let library = state.library.lock().unwrap();
    Ok(library.clone())
}

#[tauri::command]
fn remove_book(state: State<'_, AppState>, identifier: String) -> Result<Option<Book>, String> {
    let mut library = state.library.lock().unwrap();
    let book = library.remove(&identifier);
    
    save_library(&library)?;
    let mut last_save = state.last_save.lock().unwrap();
    *last_save = Instant::now();
    
    Ok(book)
}

#[tauri::command]
fn open_epub(state: State<'_, AppState>, path: String) -> Result<Book, String> {
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

    save_library(&library)?;
    let mut last_save = state.last_save.lock().unwrap();
    *last_save = Instant::now();
    
    Ok(book)
}

#[tauri::command]
fn get_cover(state: State<'_, AppState>, identifier: String) -> Result<Option<String>, String> {
    let mut library = state.library.lock().unwrap();
    let sources = library.get(&identifier).ok_or_else(|| format!("No entry for {}", identifier))?.sources.clone();
    let (doc, missing) = load_epub_doc(&sources);
    let mut doc = doc.ok_or_else(|| format!("No valid sources for {}", identifier))?;
    
    if prune_sources(&mut library, &identifier, &missing)? {
        save_library(&library)?;
        let mut last_save = state.last_save.lock().unwrap();
        *last_save = Instant::now();
    }

    Ok(doc.get_cover().map(|(data, mime)| {
        format!("data:{};base64,{}", mime, STANDARD.encode(data))
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let library = load_library().unwrap_or_default();
    tauri::Builder::default()
        .manage(AppState {
            library: Mutex::new(library),
            last_save: Mutex::new(Instant::now()),
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_library,
            remove_book,
            open_epub,
            get_cover
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
