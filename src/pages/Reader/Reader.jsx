import './Reader.css';
import { useState, useEffect, useRef, useMemo } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useCustomStyles } from '@/context/CustomStylesContext';
import { useBookSetting } from '@/hooks/useBookSetting';
import FoliateReader from '@/components/FoliateReader';
import TableOfContents from './TableOfContents';
import ReaderHeader from './ReaderHeader/ReaderHeader';

function Reader({ identifier, book }) {
    const [fontSize, setFontSize] = useState(localStorage.getItem('fontSize') || '18');
    const [fontFamily, setFontFamily] = useState(localStorage.getItem('font') || 'initial');
    const [useEpubStyles, setUseEpubStyles] = useBookSetting(identifier, 'useEpubStyles');
    const [allowPopups, setAllowPopups] = useBookSetting(identifier, 'allowPopups');

    const [expandToc, setExpandToc] = useState(false);
    const [location, setLocation] = useState(book.current_location);
    const [progress, setProgress] = useState(0);
    const [chapter, setChapter] = useState('');
    const [page, setPage] = useState('');

    const viewRef = useRef(null);
    const backBtnRef = useRef(null);
    const useEpubStylesRef = useRef(useEpubStyles);
    const allowPopupsRef = useRef(allowPopups);

    const bgPrimary = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim(), []);
    const textPrimary = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(), []);
    const textLink = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--text-link').trim(), []);

    const customStyles = useCustomStyles();

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('wheel', onWheel);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
            document.removeEventListener('wheel', onWheel);
        };
    }, []);

    useEffect(() => {
        getCurrentWindow().setTitle(book.title);
    }, [book.title]);

    useEffect(() => {
        if (!fontSize) return;
        localStorage.setItem('fontSize', fontSize);
        buildStyles();
    }, [fontSize]);

    useEffect(() => {
        if (!fontFamily) return;
        localStorage.setItem('font', fontFamily);
        buildStyles();
    }, [fontFamily]);

    useEffect(() => {
        useEpubStylesRef.current = useEpubStyles;
        toggleEpubStyles();
    }, [useEpubStyles]);

    useEffect(() => {
        allowPopupsRef.current = allowPopups;
    }, [allowPopups]);

    useEffect(() => {
        invoke('save_progress', { identifier, location }).catch((err) => console.log(err));
    }, [identifier, location]);

    async function buildStyles() {
        const view = viewRef.current;
        if (!view?.renderer?.setStyles) return;

        const css = `
            @namespace epub "http://www.idpf.org/2007/ops";
            body {
                background: ${bgPrimary};
                color: ${textPrimary};
            }

            a:link {
                color: ${textLink};
            }

            h1, h2, h3, h4, h5, h6 {
                margin-block-end: 1em;
                text-align: center;
            }

            ${customStyles.epub}

            body {
                font-size: ${fontSize}px;
                font-family: ${fontFamily};
            }
        `;

        await view.renderer.setStyles(css);
    }

    function onInit() {
        viewRef.current?.addEventListener('external-link', e => {
            e.preventDefault();
            if (allowPopupsRef.current) openUrl(e.detail.href);
        });
        buildStyles();
    }

    function onLoad(e) {
        const { doc } = e.detail;
        doc.addEventListener('keydown', onKeyDown);
        doc.addEventListener('wheel', onWheel);
        toggleEpubStyles(doc);
    }

    function onRelocate(e) { setLocation(e.detail.cfi); }
    function onRelocated(e) {
        const { fraction, tocItem } = e.detail;
        setProgress(Math.round(fraction * 100));
        setChapter(tocItem?.label ?? '');

        const view = viewRef.current;
        if (view?.renderer) {
            const pad = 2;
            const { page, pages } = view.renderer;
            if (pages >= pad) setPage(`${page} / ${pages - pad}`);
        }
    }

    function toggleEpubStyles(doc) {
        doc = doc ?? viewRef.current?.renderer?.getContents()[0]?.doc;
        if (!doc) return;
        doc.querySelectorAll('link[rel="stylesheet"]').forEach(el => el.disabled = !useEpubStylesRef.current);
    }

    const prev = () => viewRef.current?.goLeft();
    const next = () => viewRef.current?.goRight();

    function onKeyDown(e) {
        if (e.key === 'ArrowLeft') prev();
        else if (e.key === 'ArrowRight') next();
    }

    function onWheel(e) {
        if (e.deltaY < 0) prev();
        else if (e.deltaY > 0) next();
    }

    return (
        <div className='reader'>
            <ReaderHeader
                backBtnRef={backBtnRef}
                fontFamily={fontFamily}
                setFontFamily={setFontFamily}
                fontSize={fontSize}
                setFontSize={setFontSize}
                useEpubStyles={useEpubStyles}
                setUseEpubStyles={setUseEpubStyles}
                allowPopups={allowPopups}
                setAllowPopups={setAllowPopups}
            />
            <div className={`reader-body ${expandToc ? 'expand' : ''}`}>
                <TableOfContents viewRef={viewRef} expandToc={expandToc} setExpandToc={setExpandToc} backBtnRef={backBtnRef} />
                <div className='reader-content'>
                    <button className='reader-nav prev' onClick={prev}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <FoliateReader
                        bookData={convertFileSrc('book.epub', 'epub')}
                        lastLocation={location}
                        viewRef={viewRef}
                        onInit={onInit}
                        onLoad={onLoad}
                        onRelocate={onRelocate}
                        onRelocated={onRelocated}
                    />
                    <button className='reader-nav next' onClick={next}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
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
