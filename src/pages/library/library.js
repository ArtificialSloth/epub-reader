import { openContextMenu } from '../../components/context-menu/context-menu.js';

const { invoke } = window.__TAURI__.core;
const { open: openDialog } = window.__TAURI__.dialog;

let openBookCallback = null;

export function setOpenBookCallback(fn) {
    openBookCallback = fn;
}

export function getSortPreference() {
    return localStorage.getItem('sort') || 'recently-added';
}

export function setSortPreference(value) {
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

    const footer = document.createElement('div');
    footer.className = 'book-footer';

    const titleEl = document.createElement('div');
    titleEl.className = 'book-title';
    titleEl.textContent = book.title || 'Untitled';

    const onRemove = async () => {
        await invoke('remove_book', { identifier });
        await renderLibrary();
    };

    const menuBtn = document.createElement('button');
    menuBtn.className = 'book-menu-btn';
    menuBtn.textContent = '⋮';
    menuBtn.title = 'More options';
    menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const rect = menuBtn.getBoundingClientRect();
        openContextMenu(rect.left, rect.bottom + 4, book, onRemove);
    });

    footer.appendChild(titleEl);
    footer.appendChild(menuBtn);

    card.appendChild(coverDiv);
    card.appendChild(footer);

    card.addEventListener('click', async () => {
        let openedBook;
        try {
            openedBook = await invoke('open_book', { identifier });
        } catch (err) {
            console.error('Failed to open book:', err);
            return;
        }
        openBookCallback?.(identifier, openedBook);
    });

    card.addEventListener('contextmenu', e => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, book, onRemove);
    });

    invoke('get_cover', { identifier }).then(src => {
        if (src) {
            const img = document.createElement('img');
            img.alt = book.title;
            img.src = src;
            coverDiv.replaceChildren(img);
        }
    }).catch(() => {
        coverDiv.classList.add('book-cover--missing');
    });

    return card;
}

export async function renderLibrary() {
    const grid = document.getElementById('book-grid');
    const empty = document.getElementById('empty-library');
    const sortBy = getSortPreference();

    let library;
    try {
        library = await invoke('get_library');
    } catch (err) {
        console.error('Failed to load library:', err);
        return;
    }
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

export async function addBook() {
    const paths = await openDialog({
        multiple: true,
        filters: [{ name: 'Epub Files', extensions: ['epub'] }]
    });
    if (!paths || paths.length === 0) return;
    await Promise.all(paths.map(path => invoke('add_book', { path })));
    await renderLibrary();
}
