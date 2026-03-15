import { openConfirmDialog } from '../dialog/dialog.js';

let activeMenu = null;

export function closeActiveMenu() {
    if (activeMenu) {
        activeMenu.remove();
        activeMenu = null;
    }
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString();
}

export function openContextMenu(x, y, book, onRemove) {
    closeActiveMenu();

    const menu = document.createElement('div');
    menu.className = 'context-menu';

    const meta = document.createElement('div');
    meta.className = 'context-menu-meta';

    const rows = [
        ['Author',    book.author || '—'],
        ['Added',     formatDate(book.added)],
        ['Last read', formatDate(book.opened)],
        ['Chapter',   book.num_chapters ? `${(book.current_chapter ?? 0) + 1} / ${book.num_chapters}` : '—'],
    ];

    for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'context-meta-row';
        const labelEl = document.createElement('span');
        labelEl.className = 'context-meta-label';
        labelEl.textContent = label;
        const valueEl = document.createElement('span');
        valueEl.className = 'context-meta-value';
        valueEl.textContent = value;
        row.appendChild(labelEl);
        row.appendChild(valueEl);
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
            onRemove
        );
    });

    menu.appendChild(meta);
    menu.appendChild(removeBtn);
    document.body.appendChild(menu);
    activeMenu = menu;

    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = `${Math.min(x, vw - mw - 8)}px`;
    menu.style.top  = `${Math.min(y, vh - mh - 8)}px`;
}
