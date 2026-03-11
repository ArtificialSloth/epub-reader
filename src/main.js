const { invoke } = window.__TAURI__.core;
const { open: openDialog } = window.__TAURI__.dialog;
const { getCurrentWindow, LogicalSize } = window.__TAURI__.window;

async function initWindow() {
    const win = getCurrentWindow();
    const w = Math.round(screen.width * 0.8);
    const h = Math.round(screen.height * 0.8);
    await win.setSize(new LogicalSize(w, h));
    await win.center();
}

function getSortPreference() {
    return localStorage.getItem('sort') || 'recently-added';
}

function setSortPreference(value) {
    localStorage.setItem('sort', value);
}

function sortBooks(entries, sortBy) {
    return [...entries].sort((a, b) => {
        switch (sortBy) {
            case 'recently-added': return b[1].added - a[1].added;
            case 'recently-read':  return b[1].opened - a[1].opened;
            case 'a-z':            return a[1].title.localeCompare(b[1].title);
            case 'z-a':            return b[1].title.localeCompare(a[1].title);
            default:               return 0;
        }
    });
}

function createBookCard(identifier, book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.dataset.identifier = identifier;

    const coverDiv = document.createElement('div');
    coverDiv.className = 'book-cover';

    const placeholder = document.createElement('div');
    placeholder.className = 'book-cover-placeholder';
    placeholder.textContent = book.title || 'Untitled';
    coverDiv.appendChild(placeholder);

    const titleEl = document.createElement('div');
    titleEl.className = 'book-title';
    titleEl.textContent = book.title || 'Untitled';

    card.appendChild(coverDiv);
    card.appendChild(titleEl);

    invoke('get_cover', { sources: book.sources }).then(src => {
        if (src) {
            const img = document.createElement('img');
            img.alt = book.title;
            img.src = src;
            coverDiv.replaceChildren(img);
        }
    });

    return card;
}

async function renderLibrary() {
    const grid = document.getElementById('book-grid');
    const empty = document.getElementById('empty-library');
    const sortBy = getSortPreference();

    const library = await invoke('load_library');
    const entries = Object.entries(library);

    grid.replaceChildren();

    if (entries.length === 0) {
        empty.classList.add('visible');
        return;
    }

    empty.classList.remove('visible');

    const sorted = sortBooks(entries, sortBy);
    for (const [identifier, book] of sorted) {
        grid.appendChild(createBookCard(identifier, book));
    }
}

async function addBook() {
    const paths = await openDialog({
        multiple: true,
        filters: [{ name: 'Epub Files', extensions: ['epub'] }]
    });
    if (!paths || paths.length === 0) return;
    for (const path of paths) {
        await invoke('open_epub', { path });
    }
    await renderLibrary();
}

window.addEventListener('DOMContentLoaded', async () => {
    await initWindow();

    const sortSelect = document.getElementById('sort-select');
    sortSelect.value = getSortPreference();

    sortSelect.addEventListener('change', () => {
        setSortPreference(sortSelect.value);
        renderLibrary();
    });

    document.getElementById('add-book-btn').addEventListener('click', addBook);

    await renderLibrary();
});
