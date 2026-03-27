import './BookCard.css';
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { usePage } from '@/context/PageContext';
import ContextMenu from '@/components/ContextMenu';
import PopUp from '@/components/Popup';

function formatDate(timestamp) {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString();
}

function BookCard({ identifier, book, onRemove }) {
    const { navigate } = usePage();

    const [menuPos, setMenuPos] = useState(null);
    const [popupOpen, setPopupOpen] = useState(false);
    const [cover, setCover] = useState('loading');
    const [useEpubStyles, setUseEpubStyles] = useState(localStorage.getItem(`${identifier}:useEpubStyles`) === 'true');
    const [allowPopups, setAllowPopups] = useState(localStorage.getItem(`${identifier}:allowPopups`) === 'true');

    const contextBtnRef = useRef(null);

    useEffect(() => {
        invoke('get_cover', { identifier }).then(setCover).catch(err => {
            console.error(err);
            setCover('error');
        });
    }, [identifier]);

    useEffect(() => {
        if (useEpubStyles) localStorage.setItem(`${identifier}:useEpubStyles`, useEpubStyles);
        else localStorage.removeItem(`${identifier}:useEpubStyles`);
    }, [useEpubStyles]);

    useEffect(() => {
        if (allowPopups) localStorage.setItem(`${identifier}:allowPopups`, allowPopups);
        else localStorage.removeItem(`${identifier}:allowPopups`);
    }, [allowPopups]);

    async function onClick() {
        await invoke('open_book', { identifier })
            .then(result => navigate('reader', { identifier, book: result }))
            .catch(err => console.error(err));
    }

    function onClickRemoveBtn(e) {
        setMenuPos(null);
        setPopupOpen(true);
    }

    function onClickContextBtn(e) {
        e.stopPropagation();
        if (menuPos) return setMenuPos(null);
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPos({ x: rect.left, y: rect.bottom + 4 });
    }

    function onContextMenu(e) {
        e.preventDefault();
        setMenuPos({ x: e.clientX, y: e.clientY });
    }

    return (
        <div className={`book-card ${menuPos ? 'context' : ''}`} onClick={onClick} onContextMenu={onContextMenu}>
            <div className='book-cover'>
                {(() => {
                    if (cover === 'error') return (
                        <div className='book-cover-missing'>
                            <p className='missing-label'>{book.title}</p>
                            <p className='missing-text'>No valid sources found</p>
                        </div>
                    );
                    else if (cover === 'loading') return <div className='loader'></div>;
                    else if (cover === '') return <div className='cover-placeholder'>{book.title}</div>;
                    else return <img src={cover}></img>;
                })()}
            </div>
            <div className='book-footer'>
                <div className='book-title'>{book.title}</div>
                <button ref={contextBtnRef} className='book-context-btn' onClick={onClickContextBtn}>⋮</button>
                {menuPos && (
                    <ContextMenu parentRef={contextBtnRef} x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)}>
                        <div className='context-meta'>
                            <div className='context-meta-label'>Author:</div>
                            <div className='context-meta-item'>{book.author || '_'}</div>
                            <div className='context-meta-label'>Added:</div>
                            <div className='context-meta-item'>{formatDate(book.added)}</div>
                            <div className='context-meta-label'>Last Read:</div>
                            <div className='context-meta-item'>{formatDate(book.opened)}</div>
                        </div>
                        <div className='book-settings'>
                            <div className='settings-item'>
                                <p>Use ePub Styles</p>
                                <input type='checkbox' checked={useEpubStyles} onChange={e => setUseEpubStyles(e.target.checked)} />
                            </div>
                            <div className='settings-item'>
                                <p>Allow Popups</p>
                                <input type='checkbox' checked={allowPopups} onChange={e => setAllowPopups(e.target.checked)} />
                            </div>
                        </div>
                        <button className='danger' onClick={onClickRemoveBtn}>Remove From Library</button>
                    </ContextMenu>
                )}
                {popupOpen && (
                    <PopUp onConfirm={e => onRemove(identifier)} onClose={() => setPopupOpen(false)}>
                        <p className='popup-label'>Remove "{book.title}"?</p>
                        <p className='popup-text'>The file will remain, but all saved progress will be lost.</p>
                        <div className='popup-actions'>
                            <button onClick={e => setPopupOpen(false)}>Cancel</button>
                            <button className='danger' onClick={() => onRemove(identifier)}>Remove</button>
                        </div>
                    </PopUp>
                )}
            </div>
        </div>
    );
}

export default BookCard;
