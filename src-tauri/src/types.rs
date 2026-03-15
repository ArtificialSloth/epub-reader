use std::{collections::HashMap, sync::Mutex, time::Instant};

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
    pub scroll_position: f64,
}

pub struct AppState {
    pub library: Mutex<Library>,
    pub last_save: Mutex<Instant>,
}