import './Reader.css'
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { usePage } from '@/PageContext'
import Header from '@/components/Header/Header'

function Reader({ identifier, initBook }) {
    const { navigate } = usePage();
    const [book, setBook] = useState(initBook);

    const [isFullscreen, setIsFullscreen] = useState(false);
    useEffect(() => {
        const win = getCurrentWindow();
        async function checkFullscreen() {
            setIsFullscreen(await win.isFullscreen());
        }
        win.setTitle(book.title);
        checkFullscreen();
    }, []);

    const [chapter, setChapter] = useState('');
    async function fetchChapter(index) {
        try {
            const result = await invoke('get_chapter', { index });
            const doc = new DOMParser().parseFromString(result, 'text/html');

            doc.querySelectorAll('script').forEach(el => el.remove());
            setChapter(doc.body.innerHTML);

            const newBook = await invoke('save_progress', { identifier, chapterIndex: index, positionIndex: 0 })
            setBook(newBook);
        } catch (err) {
            console.error(err);
        }
    }
    useEffect(() => { fetchChapter(book.current_chapter) }, []);

    async function setFullscreen(fs) {
        const win = getCurrentWindow();
        win.setFullscreen(fs).then(async () => {
            setIsFullscreen(await win.isFullscreen());
        })
    }

    function prevChapter(e) {
        e.preventDefault();
        if (book.current_chapter > 0) {
            fetchChapter(book.current_chapter - 1);
        }
    }

    function nextChapter(e) {
        e.preventDefault();
        if (book.current_chapter < book.num_chapters) {
            fetchChapter(book.current_chapter + 1);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key == 'ArrowLeft') prevChapter(e)
        else if (e.key == 'ArrowRight') nextChapter(e);
    });

    return (
        <div className='reader'>
            <Header
                left={(
                    <button className='reader-back-btn' onClick={() => navigate('library')} >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                )}
                right={(
                    <div className='reader-controls'>
                        {!isFullscreen ? (
                            <button className='reader-fullscreen-btn' onClick={() => setFullscreen(true)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                            </button>
                        ) : (
                            <button className='reader-minimize-btn' onClick={() => setFullscreen(false)}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path></svg>
                            </button>
                        )}
                    </div>
                )}
            />
            <div className='reader-body'>
                <div className='chapter-wrapper'>
                    <div className='chapter-nav prev' onClick={prevChapter}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </div>
                    <div className='chapter-content' dangerouslySetInnerHTML={{ __html: chapter }} />
                    <div className='chapter-nav next' onClick={nextChapter}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                </div>
                <div className='chapter-progress'>0 / 1 ({Math.round((book.current_chapter / book.num_chapters) * 100)}%)</div>
            </div>
            <footer className='reader-footer'>
                <div className='progress-bar'>
                    {Array.from({ length: book.num_chapters }, (_, i) => (
                        <div key={i} className={'progress-section ' + (i < book.current_chapter ? 'past' : i == book.current_chapter ? 'current' : '')} onClick={() => fetchChapter(i)}>
                            <div className='progress-tip'>{i} / {book.num_chapters}</div>
                        </div>
                    ))}
                </div>
            </footer >
        </div >
    );
}

export default Reader
