import './BookCard.css'
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import ContextMenu from '@/components/ContextMenu/ContextMenu';
import PopUp from '@/components/PopUp/PopUp';

function formatDate(timestamp) {
    if (!timestamp) return '—';
    return new Date(timestamp * 1000).toLocaleDateString();
}

function BookCard({identifier, book, onRemove}) { 
    const [menuPos, setMenuPos] = useState(null);
    const [popupOpen, setPopupOpen] = useState(false);
    const [cover, setCover] = useState('loading');
    useEffect(() => {
        async function fetchCover() {
            try {
                setCover(await invoke('get_cover', {identifier}));
            } catch (err) {
                console.error(err);
                setCover('error');
            }
        }
        fetchCover();
    }, [identifier]);

    function onClickRemoveBtn() {
        setMenuPos(null);
        setPopupOpen(true);
    }

    function onClickContextBtn(e) {
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPos({x: rect.left, y: rect.bottom + 4});
    }

    function onContextMenu(e) {
        e.preventDefault();
        setMenuPos({x: e.clientX, y: e.clientY});
    }

    return (
        <div className='book-card' onContextMenu={onContextMenu}>
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
                <button className='book-context-btn' onClick={onClickContextBtn}>⋮</button>
                {menuPos && (
                    <ContextMenu x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)}>
                        <div className='context-meta'>
                            <div className='context-meta-label'>Author:</div>
                            <div className='context-meta-item'>{book.author}</div>
                            <div className='context-meta-label'>Added:</div>
                            <div className='context-meta-item'>{formatDate(book.added)}</div>
                            <div className='context-meta-label'>Last Read:</div>
                            <div className='context-meta-item'>{formatDate(book.opened)}</div>
                            <div className='context-meta-label'>Chapter:</div>
                            <div className='context-meta-item'>{book.current_chapter}/{book.num_chapters}</div>
                        </div>
                        <button className='danger' onClick={onClickRemoveBtn}>Remove From Library</button>
                    </ContextMenu>
                )}
                {popupOpen && (
                    <PopUp onConfirm={() => onRemove(identifier)} onClose={() => setPopupOpen(false)}>
                        <p className='popup-label'>Remove "{book.title}"?</p>
                        <p className='popup-text'>The file will remain, but all saved progress will be lost.</p>
                        <div className='popup-actions'>
                            <button onClick={() => setPopupOpen(false)}>Cancel</button>
                            <button className='danger' onClick={() => onRemove(identifier)}>Remove</button>
                        </div>
                    </PopUp>
                )}
            </div>
        </div>
    );
}

export default BookCard