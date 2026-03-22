import './Reader.css'
import { useState, useEffect, useRef, useCallback } from 'react'
import { ReactReader, ReactReaderStyle } from 'react-reader'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { usePage } from '@/PageContext'
import Header from '@/components/Header/Header'

const bgPrimary = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
const textSecondary = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim();
const textMuted = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
const textLink = getComputedStyle(document.documentElement).getPropertyValue('--text-link').trim();
const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();

const readerStyles = {
    ...ReactReaderStyle,
    readerArea: {
        ...ReactReaderStyle.readerArea,
        background: bgPrimary,
    },
    containerExpanded: {
        ...ReactReaderStyle.containerExpanded,
        transform: 'translateX(384px)',
    },
    arrow: {
        ...ReactReaderStyle.arrow,
        color: textMuted,
        padding: '0 32px',
    },
    tocBackground: {
        ...ReactReaderStyle.tocBackground,
        left: 384,
    },
    tocArea: {
        ...ReactReaderStyle.tocArea,
        background: bgPrimary,
        width: 384,
    },
    tocAreaButton: {
        ...ReactReaderStyle.tocAreaButton,
        borderBottom: `1px solid ${borderColor}`,
        borderRadius: 0,
        color: textSecondary,
        paddingLeft: 44,
    },
    tocButton: {
        ...ReactReaderStyle.tocButton,
        color: textMuted,
        left: 36,
        top: 0,
    },
    tocButtonExpanded: {
        ...ReactReaderStyle.tocButtonExpanded,
        background: bgPrimary,
    },
    tocButtonBar: {
        ...ReactReaderStyle.tocButtonBar,
        background: textMuted,
    },
};

const contentStyles = {
    body: { background: `${bgPrimary}`, color: `${textPrimary}`, 'font-size': '18px' },
    h1: { 'text-align': 'center !important' },
    a: { color: `${textLink}` },
};

function baseHref(href) { return href.split("#")[0].split("/").pop(); }
function trimHref(href) { return href.startsWith('../') ? href.slice('../'.length) : href; }
function flatten(chapters) {
    return [].concat.apply([], chapters.map((chapter) => [].concat.apply([chapter], flatten(chapter.subitems))));
}

function Reader({ identifier, book }) {
    const { navigate } = usePage();

    const [epubData, setEpubData] = useState('loading');
    const [location, setLocation] = useState(book.current_location || 0);
    const [chapter, setChapter] = useState('');
    const [page, setPage] = useState('');
    const renditionRef = useRef(null);
    const tocRef = useRef(null);
    const indexedTocRef = useRef(null);
    const contentCfiMap = useRef([]);

    useEffect(() => {
        fetch(convertFileSrc('book.epub', 'epub')).then(res => res.arrayBuffer()).then(setEpubData).catch(err => {
            console.error(err);
            setEpubData(String(err));
        });
    }, []);

    const [isFullscreen, setIsFullscreen] = useState(false);
    useEffect(() => {
        const win = getCurrentWindow();
        win.setTitle(book.title);
        win.isFullscreen().then(setIsFullscreen);
    }, [book.title]);

    function setFullscreen(fsn) {
        const win = getCurrentWindow();
        win.setFullscreen(fsn).then(() => win.isFullscreen().then(setIsFullscreen)).catch(err => console.error(err));
    }

    function tryIndexToc() {
        const rendition = renditionRef.current; const toc = tocRef.current;
        if (!rendition || !toc) return;

        const indexedToc = [];
        for (const entry of toc) {
            const spineItem = rendition.book.spine.spineItems.find(s => baseHref(s.href) === baseHref(entry.href));
            if (!spineItem) continue;

            indexedToc.push({ ...entry, index: spineItem.index });
            indexedTocRef.current = indexedToc;
        }
    }

    const onLocationChanged = useCallback((loc) => {
        loc = trimHref(loc);
        setLocation(loc);

        const rendition = renditionRef.current;
        const indexedToc = indexedTocRef.current;
        if (rendition && indexedToc) {
            const { displayed, href, cfi, index } = rendition.location.start;
            setPage(`${Math.round(displayed.page / 2)} / ${Math.round(displayed.total / 2)}`);

            const label = contentCfiMap.current.findLast((e) => rendition.epubcfi.compare(e.cfi, cfi) <= 0)?.label ??
                indexedToc.find(entry => entry.href === href)?.label ?? // this seemingly never works
                indexedToc.find(entry => baseHref(entry.href) === baseHref(href))?.label ??
                indexedToc.findLast(entry => entry.index <= index)?.label;
            setChapter(label ?? '');
        }

        if (loc.startsWith('epubcfi')) {
            invoke('save_progress', { identifier, location: loc });
        };
    }, [identifier]);

    function getRendition(rendition) {
        rendition.themes.register('styles', contentStyles);
        rendition.themes.select('styles');

        rendition.hooks.content.register((contents) => {
            const doc = contents.document;
            doc.querySelectorAll('link[rel="stylesheet"], style:not(#epubjs-inserted-css-, #epubjs-inserted-css-styles)')
                .forEach(el => el.remove());

            if (!tocRef.current) return;
            const sectionFile = baseHref(rendition.book.spine.get(contents.sectionIndex).href);
            const entries = flatten(tocRef.current).filter(entry => baseHref(entry.href) === sectionFile);
            const cfiMap = entries.flatMap(entry => {
                const id = entry.href.split('#')[1];
                const el = id && contents.document.getElementById(id);
                return el ? { label: entry.label, cfi: contents.cfiFromNode(el) } : [];
            }, []);
            contentCfiMap.current = [
                ...contentCfiMap.current.filter(e => e.section !== sectionFile),
                ...cfiMap.map(e => ({ ...e, section: sectionFile })),
            ];
        });

        let inititialRelocate = true;
        const contentEl = document.querySelector('.reader-body div div:first-child div:nth-child(3)');
        if (contentEl) {
            rendition.on('started', () => contentEl.style.opacity = 0);
            rendition.on('rendered', () => contentEl.style.opacity = 0);
            rendition.on('displayError', () => contentEl.style.opacity = 1);

            const prev = rendition.prev.bind(rendition);
            const next = rendition.next.bind(rendition);
            rendition.prev = () => {
                if (rendition.location && !rendition.location.atStart) contentEl.style.opacity = 0;
                prev();
            }
            rendition.next = () => {
                if (rendition.location && !rendition.location.atEnd) contentEl.style.opacity = 0;
                next();
            }
        }
        rendition.on('relocated', async (args) => {
            if (!inititialRelocate) {
                if (contentEl) contentEl.style.opacity = 1;
                const loc = rendition.location.start.cfi;
                if (loc) onLocationChanged(loc);
            } else {
                inititialRelocate = false;
                if (book.current_location) {
                    await rendition.display(book.current_location);
                    await rendition.display(book.current_location);
                }
            }
        });

        renditionRef.current = rendition;
        tryIndexToc();
    };

    async function onClickBackBtn(e) {
        await invoke('save_progress', { identifier, location });
        await invoke('close_book');
        navigate('library');
    }

    return (
        <div className='reader'>
            <Header
                left={(
                    <button className='reader-back-btn' onClick={onClickBackBtn} >
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
                {(() => {
                    if (epubData === 'loading') return <div className='loader-wrapper'><div className='loader'></div></div>;
                    else if (typeof epubData === 'string') return <div className='reader-error'><div className='error-text'>{epubData}</div></div>;
                    else return (
                        <ReactReader
                            url={epubData}
                            location={location}
                            locationChanged={onLocationChanged}
                            tocChanged={toc => { tocRef.current = toc; tryIndexToc(); }}
                            getRendition={getRendition}
                            readerStyles={readerStyles}
                        />
                    );
                })()}
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

export default Reader
