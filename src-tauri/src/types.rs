use std::{collections::HashMap, sync::Mutex, time::Instant};

pub type Library = HashMap<String, Book>;

#[derive(Default, serde::Serialize, serde::Deserialize, Clone)]
pub struct Book {
    pub title: String,
    pub author: String,
    pub sources: Vec<String>,
    pub added: u64,
    pub opened: u64,
    pub num_chapters: usize,
    pub current_location: String,
}

pub struct LibraryState {
    pub library: Library,
    pub last_save: Instant,
}

pub struct AppState {
    pub library_state: Mutex<LibraryState>,
    pub current_book: Mutex<Option<Vec<u8>>>,
}
