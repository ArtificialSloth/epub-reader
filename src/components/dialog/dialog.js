export function openConfirmDialog(title, message, onConfirm) {
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

    overlay.addEventListener('click', e => {
        if (e.target === overlay) { overlay.remove(); document.removeEventListener('keydown', onKey); }
    });
    document.addEventListener('keydown', function onKey(e) {
        if (e.key === 'Escape')  { overlay.remove(); document.removeEventListener('keydown', onKey); }
        if (e.key === 'Enter')   { confirmBtn.click(); document.removeEventListener('keydown', onKey); }
    });
}
