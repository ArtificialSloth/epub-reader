import { renderLibrary, addBook, getSortPreference, setSortPreference, setOpenBookCallback } from './pages/library/library.js';
import { initReader, cleanupReader } from './pages/reader/reader.js';
import { closeActiveMenu } from './components/context-menu/context-menu.js';

const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;

async function initWindow() {
    const win = getCurrentWindow();
    const w = Math.round(screen.width * 0.8);
    const h = Math.round(screen.height * 0.8);
    await win.setSize(new LogicalSize(w, h));
    await win.center();
}

async function showLibraryPage() {
    await getCurrentWindow().setTitle('Epub Reader');
    document.getElementById('reader-page').style.display = 'none';
    document.getElementById('library-page').style.display = '';
    await renderLibrary();
}

async function showReaderPage(identifier, book) {
    document.getElementById('library-page').style.display = 'none';
    document.getElementById('reader-page').style.display = 'flex';
    await initReader(identifier, book, showLibraryPage);
}

document.addEventListener('click', closeActiveMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeActiveMenu(); });

await initWindow();

setOpenBookCallback(showReaderPage);

const sortSelect = document.getElementById('sort-select');
sortSelect.value = getSortPreference();

sortSelect.addEventListener('change', () => {
    setSortPreference(sortSelect.value);
    renderLibrary();
});

document.getElementById('add-book-btn').addEventListener('click', addBook);

await renderLibrary();
