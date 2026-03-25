import './Reader.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePage } from '@/PageContext';
import FoliateReader from '@/components/FoliateReader';
import ContextMenu from '@/components/ContextMenu';
import Select from '@/components/Select';

const bgPrimary = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
const textLink = getComputedStyle(document.documentElement).getPropertyValue('--text-link').trim();

function Reader({ identifier, book }) {
    const { navigate } = usePage();

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [menuPos, setMenuPos] = useState(null);
    const [fontSize, setFontSize] = useState(Number(localStorage.getItem('fontSize')) || 18);
    const [font, setFont] = useState(localStorage.getItem('font') || 'initial');
    const [useEpubStyles, setUseEpubStyles] = useState(localStorage.getItem(`${identifier}:useEpubStyles`) === 'true');

    const [location, setLocation] = useState(book.current_location || '');
    const [chapter, setChapter] = useState('');
    const [page, setPage] = useState('');

    const containerRef = useRef(null);
    const viewRef = useRef(null);

    useEffect(() => {
        document.addEventListener('keydown', onKeydown);
        document.addEventListener('wheel', onWheel);
        return () => {
            document.removeEventListener('keydown', onKeydown);
            document.removeEventListener('wheel', onWheel);
        };
    }, []);

    useEffect(() => {
        const win = getCurrentWindow();
        win.setTitle(book.title);
        win.isFullscreen().then(setIsFullscreen);
    }, [book.title]);

    useEffect(() => {
        function onBlur() { if (menuPos && document.activeElement?.tagName === 'FOLIATE-VIEW') setMenuPos(null); }
        if (menuPos) window.addEventListener('blur', onBlur);
        else window.removeEventListener('blur', onBlur);
        return () => window.removeEventListener('blur', onBlur);
    }, [menuPos]);

    useEffect(() => {
        if (!fontSize) return;
        localStorage.setItem('fontSize', fontSize);
        buildStyles();
    }, [fontSize]);

    useEffect(() => {
        if (!font) return;
        localStorage.setItem('font', font);
        buildStyles();
    }, [font]);

    useEffect(() => {
        const renderer = viewRef.current?.renderer;
        if (useEpubStyles) {
            localStorage.setItem(`${identifier}:useEpubStyles`, useEpubStyles);
            if (renderer) {
                const { doc } = viewRef.current.renderer.getContents()[0];
                doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.removeAttribute('disabled'));
            }
        } else {
            localStorage.removeItem(`${identifier}:useEpubStyles`);
            if (renderer) {
                const { doc } = viewRef.current.renderer.getContents()[0];
                doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.disabled = true);
            }
        }
    }, [useEpubStyles]);

    useEffect(() => {
        invoke('save_progress', { identifier, location });
    }, [identifier, location]);

    async function buildStyles() {
        const view = viewRef.current;
        if (!view?.renderer?.setStyles) return;

        const css = `
            @namespace epub "http://www.idpf.org/2007/ops";
            body {
                background: ${bgPrimary};
                color: ${textPrimary};
                font-family: ${font};
                font-size: ${fontSize}px;
            }
            
            a:link {
                color: ${textLink};
            }
        `;

        view.renderer.setAttribute('max-inline-size', '80%');
        await view.renderer.setStyles(css);
    }

    function onLoad(e) {
        if (containerRef.current) containerRef.current.style.opacity = 0;

        const view = viewRef.current;
        if (!view) return;

        const { doc } = e.detail;
        if (localStorage.getItem(`${identifier}:useEpubStyles`) !== 'true') {
            doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.disabled = true);
        }

        doc.addEventListener('keydown', onKeydown);
        buildStyles();
    }

    function onRelocate(e) {
        const { cfi, tocItem } = e.detail;
        setLocation(cfi);

        const view = viewRef.current;
        clearTimeout(viewRef._relocateTimeout);
        viewRef._relocateTimeout = setTimeout(() => {
            if (containerRef.current) containerRef.current.style.opacity = 1;
            setChapter(tocItem?.label ?? '');
            if (view?.renderer) {
                const { page, pages } = view.renderer;
                if (pages > 0) setPage(`${page} / ${pages - 2}`);
            }
        }, 50);
    }

    async function onKeydown(e) {
        const view = viewRef.current;
        if (!view) return;

        if (e.key === 'ArrowLeft') await view.goLeft();
        else if (e.key === 'ArrowRight') await view.goRight();
    }

    async function onWheel(e) {
        const view = viewRef.current;
        if (!view) return;

        if (e.deltaY < 0) await view.goLeft();
        else if (e.deltaY > 0) await view.goRight();
    }

    function setFullscreen(fsn) {
        const win = getCurrentWindow();
        win.setFullscreen(fsn).then(() => win.isFullscreen().then(setIsFullscreen)).catch(err => console.error(err));
    }

    async function onClickBackBtn() {
        await invoke('save_progress', { identifier, location });
        await invoke('close_book');
        navigate('library');
    }

    function onClickSettingsBtn(e) {
        e.stopPropagation();
        if (menuPos) return setMenuPos(null);
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPos({ x: rect.left, y: rect.bottom + 4 });
    }

    const settingsBtnRef = useRef(null);
    return (
        <div className='reader'>
            {!isFullscreen ? (
                <div className='reader-header'>
                    <button className='reader-back-btn' onClick={onClickBackBtn}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <div className='reader-controls'>
                        <button ref={settingsBtnRef} className='reader-settings-btn' title='Settings' onClick={onClickSettingsBtn}>Aa</button>
                        {menuPos && (
                            <ContextMenu parentRef={settingsBtnRef} x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)}>
                                <div className='settings-item'>
                                    <p>Font Size</p>
                                    <p><input type='number' value={fontSize} onChange={e => setFontSize(e.target.value)} />px</p>
                                </div>
                                <div className='settings-item'>
                                    <p>Font</p>
                                    <Select value={font} onChange={e => setFont(e.target.value)}>
                                        <option value='initial'>Default</option>
                                        <option value='Times New Roman'>Times new Roman</option>
                                        <option value='sans-serif'>Sans-serif</option>
                                        <option value='monospace'>Monospace</option>
                                    </Select>
                                </div>
                                <div className='settings-item'>
                                    <p>Use ePub Styles</p>
                                    <input type='checkbox' checked={useEpubStyles} onChange={e => setUseEpubStyles(e.target.checked)} />
                                </div>
                            </ContextMenu>
                        )}
                        <div className='control-separator'></div>
                        <button className='reader-fullscreen-btn' title='Fullscreen' onClick={() => setFullscreen(true)}>
                            <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'></path></svg>
                        </button>
                    </div>
                </div>
            ) : (
                <button className='reader-minimize-btn' title='Minimize' onClick={() => setFullscreen(false)}>
                    <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3'></path></svg>
                </button>
            )}
            <div className='reader-body'>
                <FoliateReader
                    bookData={convertFileSrc('book.epub', 'epub')}
                    lastLocation={book.current_location}
                    containerRef={containerRef}
                    viewRef={viewRef}
                    onLoad={onLoad}
                    onRelocate={onRelocate}
                />
            </div>
            {page && (
                <div className='reader-footer'>
                    <p>{page}</p>
                    <p>{chapter}</p>
                </div>
            )}

        </div >
    );
}

export default Reader;
