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

let activeMenu = null;

function closeActiveMenu() {
    if (activeMenu) {
        activeMenu.remove();
        activeMenu = null;
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString();
}

function openConfirmDialog(title, message, onConfirm) {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'dialog';

    const titleEl = document.createElement('h2');
    titleEl.className = 'dialog-title';
    titleEl.textContent = title;

    const messageEl = document.createElement('p');
    messageEl.className = 'dialog-message';
    messageEl.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'dialog-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => overlay.remove());

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'dialog-btn dialog-btn--danger';
    confirmBtn.textContent = 'Remove';
    confirmBtn.addEventListener('click', async () => {
        overlay.remove();
        await onConfirm();
    });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(titleEl);
    dialog.appendChild(messageEl);
    dialog.appendChild(actions);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onKey); }
    });
}

function openContextMenu(x, y, identifier, book) {
    closeActiveMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';

    const meta = document.createElement('div');
    meta.className = 'context-menu-meta';

    const rows = [
        ['Author',          book.author || '—'],
        ['Added',           formatDate(book.added)],
        ['Last read',       formatDate(book.opened)],
        ['Chapter',         `${book.current_chapter + 1} / ${book.num_chapters}`],
    ];

    for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'context-meta-row';
        row.innerHTML = `<span class="context-meta-label">${label}</span><span class="context-meta-value">${value}</span>`;
        meta.appendChild(row);
    }

    const removeBtn = document.createElement('button');
    removeBtn.className = 'context-menu-item context-menu-item--danger';
    removeBtn.textContent = 'Remove from library';
    removeBtn.addEventListener('click', () => {
        closeActiveMenu();
        openConfirmDialog(
            `Remove "${book.title}"?`,
            'The file will not be deleted, but all saved progress will be lost.',
            async () => {
                await invoke('remove_book', { identifier });
                await renderLibrary();
            }
        );
    });

    menu.appendChild(meta);
    menu.appendChild(removeBtn);
    document.body.appendChild(menu);
    activeMenu = menu;

    // Position — keep menu inside viewport
    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = `${Math.min(x, vw - mw - 8)}px`;
    menu.style.top  = `${Math.min(y, vh - mh - 8)}px`;
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

    const menuBtn = document.createElement('button');
    menuBtn.className = 'book-menu-btn';
    menuBtn.textContent = '⋮';
    menuBtn.title = 'More options';
    menuBtn.addEventListener('click', e => {
        e.stopPropagation();
        const rect = menuBtn.getBoundingClientRect();
        openContextMenu(rect.left, rect.bottom + 4, identifier, book);
    });

    footer.appendChild(titleEl);
    footer.appendChild(menuBtn);

    card.appendChild(coverDiv);
    card.appendChild(footer);

    card.addEventListener('contextmenu', e => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, identifier, book);
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

async function renderLibrary() {
    const grid = document.getElementById('book-grid');
    const empty = document.getElementById('empty-library');
    const sortBy = getSortPreference();

    const library = await invoke('get_library');
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

document.addEventListener('click', closeActiveMenu);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeActiveMenu(); });

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
