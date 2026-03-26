import './Reader.css';
import { useState, useEffect, useRef, Fragment } from 'react';
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
    const [expandToc, setExpandToc] = useState(false);

    const [fontSize, setFontSize] = useState(Number(localStorage.getItem('fontSize')) || 18);
    const [font, setFont] = useState(localStorage.getItem('font') || 'initial');
    const [useEpubStyles, setUseEpubStyles] = useState(localStorage.getItem(`${identifier}:useEpubStyles`) === 'true');

    const [location, setLocation] = useState(book.current_location || '');
    const [progress, setProgress] = useState(0);
    const [chapter, setChapter] = useState('');
    const [page, setPage] = useState('');

    const viewRef = useRef(null);

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('wheel', onWheel);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
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
        function onMouseDown(e) { if (!backBtnRef.current?.contains(e.target)) setExpandToc(false); }
        function onKeyDown(e) { if (e.key === 'Escape') setExpandToc(false); }
        function onBlur() { if (expandToc && document.activeElement?.tagName === 'FOLIATE-VIEW') setExpandToc(false); }
        function removeListeners() {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('blur', onBlur);
        }

        if (expandToc) {
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('keydown', onKeyDown);
            window.addEventListener('blur', onBlur);
        } else removeListeners();
        return () => removeListeners();
    }, [expandToc]);

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
        if (useEpubStyles) localStorage.setItem(`${identifier}:useEpubStyles`, useEpubStyles);
        else localStorage.removeItem(`${identifier}:useEpubStyles`);
        toggleEpubStyles();
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

            h1, h2, h3, h4, h5, h6 {
                margin-block-end: 1em;
                text-align: center;
            }
        `;

        await view.renderer.setStyles(css);
    }

    function onLoad(e) {
        const { doc } = e.detail;
        doc.addEventListener('keydown', onKeyDown);
        doc.addEventListener('wheel', onWheel);

        toggleEpubStyles();
        buildStyles();
    }

    function onRelocate(e) { setLocation(e.detail.cfi); }
    function onRelocated(e) {
        const { fraction, tocItem } = e.detail;
        setProgress(Math.round(fraction * 100));
        setChapter(tocItem?.label ?? '');

        const view = viewRef.current;
        if (view?.renderer) {
            const { page, pages } = view.renderer;
            if (pages > 0) setPage(`${page} / ${pages - 2}`);
        }
    }

    async function prev() {
        const view = viewRef.current;
        if (view) await view.goLeft();
    }

    async function next() {
        const view = viewRef.current;
        if (view) await view.goRight();
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'ArrowRight') next();
    }

    async function onWheel(e) {
        if (e.deltaY < 0) prev();
        else if (e.deltaY > 0) next();
    }

    function setFullscreen(fsn) {
        const win = getCurrentWindow();
        win.setFullscreen(fsn).then(() => win.isFullscreen().then(setIsFullscreen)).catch(err => console.error(err));
    }

    function toggleEpubStyles() {
        const renderer = viewRef.current?.renderer;
        if (!renderer) return;

        const { doc } = viewRef.current.renderer.getContents()[0];
        if (useEpubStyles) doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.removeAttribute('disabled'));
        else doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.disabled = true);
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

    function onClickTocItem(tocItem) {
        viewRef.current.goTo(tocItem.href);
        setExpandToc(!expandToc);
    }

    const renderTocItems = (items, depth = 0) =>
        items?.map((entry, index) => (
            <Fragment key={`${depth}-${index}`}>
                <button className='toc-item' style={{ paddingLeft: `${32 + depth * 16}px` }} onClick={() => onClickTocItem(entry)}>
                    {entry.label}
                </button>
                {entry.subitems && renderTocItems(entry.subitems, depth + 1)}
            </Fragment>
        ));

    const backBtnRef = useRef(null);
    const settingsBtnRef = useRef(null);
    return (
        <div className='reader'>
            {!isFullscreen ? (
                <div className='reader-header'>
                    <button ref={backBtnRef} className='reader-back-btn' onClick={onClickBackBtn}>
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
            <div className={`reader-body ${expandToc ? 'expand' : ''}`}>
                {viewRef.current?.book?.toc?.length > 0 &&
                    <div className='reader-toc' onWheel={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                        {renderTocItems(viewRef.current.book.toc)}
                    </div>
                }
                <div className='reader-content'>
                    {viewRef.current?.book?.toc?.length > 0 &&
                        <button className='reader-toc-btn' onClick={() => setExpandToc(!expandToc)}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                        </button>
                    }
                    <div className='reader-nav prev' onClick={prev}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </div>
                    <FoliateReader
                        bookData={convertFileSrc('book.epub', 'epub')}
                        lastLocation={book.current_location}
                        viewRef={viewRef}
                        onLoad={onLoad}
                        onRelocate={onRelocate}
                        onRelocated={onRelocated}
                    />
                    <div className='reader-nav next' onClick={next}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                </div>
            </div>
            {page &&
                <div className='reader-footer'>
                    <p>{page}</p>
                    <p>{chapter} ({progress}%)</p>
                </div>
            }
        </div >
    );
}

export default Reader;
