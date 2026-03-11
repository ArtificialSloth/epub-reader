use std::{collections::HashMap, io::BufReader, fs::File, time::SystemTime};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use epub::doc::EpubDoc;

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

fn get_library_path() -> std::path::PathBuf {
    std::env::current_exe()
        .unwrap()
        .parent()
        .unwrap()
        .join("library.json")
}

fn get_epub_doc(sources: &[String]) -> Option<EpubDoc<BufReader<File>>> {
    sources.iter().find_map(|path| epub::doc::EpubDoc::new(path).ok())
}

#[tauri::command]
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

#[tauri::command]
fn save_library(library: Library) -> Result<(), String> {
    let path = get_library_path();
    let content = serde_json::to_string_pretty(&library).map_err(|e| e.to_string())?;

    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_epub(path: String) -> Result<Book, String> {
    let doc = epub::doc::EpubDoc::new(&path).map_err(|e| e.to_string())?;
    let now = SystemTime::duration_since(&SystemTime::now(), SystemTime::UNIX_EPOCH).map_err(|e| e.to_string())?.as_secs();

    let title = doc
        .mdata("title")
        .map(|m| m.value.clone())
        .unwrap_or_default();
    let author = doc
        .mdata("author")
        .map(|m| m.value.clone())
        .unwrap_or_default();
    let identifier = doc
        .mdata("identifier")
        .map(|m| m.value.clone())
        .unwrap_or_else(|| format!("{}:{}", title, author));

    let mut library = load_library()?;
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

    save_library(library)?;
    Ok(book)
}

#[tauri::command]
fn get_cover(sources: Vec<String>) -> Option<String> {
    let mut doc = get_epub_doc(&sources)?;
    let (data, mime) = doc.get_cover().unwrap();
    let b64 = STANDARD.encode(data);
    Some(format!("data:{};base64,{}", mime, b64))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_library,
            save_library,
            open_epub,
            get_cover
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
