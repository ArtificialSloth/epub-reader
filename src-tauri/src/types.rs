use std::{collections::HashMap, sync::Mutex, time::Instant, io::BufReader, fs::File};
use epub::doc::EpubDoc;

pub type Library = HashMap<String, Book>;

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct Book {
    pub title: String,
    pub author: String,
    pub sources: Vec<String>,
    pub added: u64,
    pub opened: u64,
    pub num_chapters: usize,
    pub current_chapter: usize,
    pub current_position: usize,
}

pub struct LibraryState {
    pub library: Library,
    pub last_save: Instant,
}

pub struct AppState {
    pub library_state: Mutex<LibraryState>,
    pub current_book: Mutex<Option<EpubDoc<BufReader<File>>>>,
}
