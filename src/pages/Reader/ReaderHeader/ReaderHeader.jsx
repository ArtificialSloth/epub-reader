import './ReaderHeader.css';
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePage } from '@/context/PageContext';
import { useEventManager } from '@/context/EventManagerContext';
import ContextMenu from '@/components/ContextMenu';
import Select from '@/components/Select';

function ReaderHeader({ viewRef, backBtnRef, fontSize, setFontSize, fontFamily, setFontFamily, useEpubStyles, setUseEpubStyles, allowPopups, setAllowPopups }) {
    const { navigate } = usePage();
    const eventManager = useEventManager();

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchState, setSearchState] = useState('hidden');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [menuPos, setMenuPos] = useState(null);

    const settingsBtnRef = useRef(null);
    const searchTimeoutRef = useRef(null);
    const searchResultsRef = useRef(searchResults);

    useEffect(() => {
        getCurrentWindow().isFullscreen().then(setIsFullscreen);
    }, []);

    useEffect(() => {
        if (searchState === 'open') eventManager.add('keydown', onKeyDown);
        else eventManager.remove('keydown', onKeyDown);
        return () => eventManager.remove('keydown', onKeyDown);
    }, [searchState]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view || !searchQuery || searchQuery.length < 2) return;

        let cancelled = false;
        let generator = null;
        async function search() {
            const opts = {
                query: searchQuery,
                matchCase: false,
                matchDiacritics: false,
                matchWholeWords: false,
            };
            generator = view.search(opts);
            for await (const result of generator) {
                if (cancelled || result === 'done') break;
                if (result.subitems) {
                    let results = searchResultsRef.current;
                    const index = results.findIndex(r => r.label === result.label);

                    if (index > -1) results[index].subitems.push(...result.subitems);
                    else results.push(result);
                    setSearchResults([...results]);
                }
            }
        }

        searchResultsRef.current = [];
        setSearchResults([]);
        search();
        return () => {
            cancelled = true;
            generator?.return();
        };
    }, [searchQuery]);

    function setFullscreen(fsn) {
        const win = getCurrentWindow();
        win.setFullscreen(fsn)
            .then(() => win.isFullscreen())
            .then(setIsFullscreen)
            .catch(err => console.error(err));
    }

    function onClickBackBtn() {
        invoke('close_book').then(() => navigate('library'))
            .catch((err) => console.error(err));
    }

    function onClickSearchBtn(e) {
        e.stopPropagation();
        setSearchState('open');
    }

    function onAnimationEnd() {
        if (searchState === 'close') setSearchState('hidden');
    }

    function onKeyDown(e) {
        e.stopPropagation();
        if (e.key === 'Escape') setSearchState('close');
    }

    function onChange(e) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => setSearchQuery(e.target.value), 200);
    }

    function onClickSearchResult(cfi) {
        setSearchState('hidden');
        viewRef.current?.goTo(cfi);
    }

    function onClickSettingsBtn(e) {
        e.stopPropagation();
        if (menuPos) return setMenuPos(null);
        const rect = e.currentTarget.getBoundingClientRect();
        setMenuPos({ x: rect.left, y: rect.bottom + 4 });
    }

    return !isFullscreen ?
        <div className='reader-header'>
            <button ref={backBtnRef} className='reader-back-btn' onClick={onClickBackBtn}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div className='reader-controls'>
                {searchState === 'hidden' ?
                    <button className='reader-search-btn' title='Search' onClick={onClickSearchBtn}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    </button>
                    :
                    <div className='reader-search'>
                        <input
                            className={`search-input ${searchState === 'close' ? 'close' : ''}`}
                            type='text'
                            placeholder='Text to match...'
                            defaultValue={searchQuery}
                            autoFocus={true}
                            onBlur={() => !searchQuery && setSearchState('close')}
                            onAnimationEnd={(onAnimationEnd)}
                            onKeyDown={onKeyDown}
                            onChange={onChange}
                        />
                        {searchState === 'open' && searchResults.length > 0 &&
                            <div className='search-results' onWheel={e => e.stopPropagation()}>
                                {searchResults.map(result =>
                                    <div key={result.label}>
                                        <div className='label'>{result.label}</div>
                                        {result.subitems.map(subitem =>
                                            <div key={subitem.cfi} className='result' onClick={() => onClickSearchResult(subitem.cfi)}>
                                                {subitem.excerpt.pre}<strong>{subitem.excerpt.match}</strong>{subitem.excerpt.post}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        }
                    </div>
                }

                <button ref={settingsBtnRef} className='reader-settings-btn' title='Settings' onClick={onClickSettingsBtn}>Aa</button>
                {menuPos &&
                    <ContextMenu parentRef={settingsBtnRef} x={menuPos.x} y={menuPos.y} onClose={() => setMenuPos(null)}>
                        <div className='reader-settings'>
                            <div className='settings-label'>Font Size</div>
                            <div className='settings-item'>
                                <input type='number' value={fontSize} onChange={e => setFontSize(e.target.value)} />px
                            </div>
                            <div className='settings-label'>Font</div>
                            <div className='settings-item'>
                                <Select value={fontFamily} setValue={setFontFamily} options={[
                                    { value: 'initial', label: 'Default', style: { fontFamily: 'initial' } },
                                    { value: 'Times New Roman', label: 'Times New Roman', style: { fontFamily: 'Times New Roman' } },
                                    { value: 'sans-serif', label: 'Sans-serif', style: { fontFamily: 'sans-serif' } },
                                    { value: 'monospace', label: 'Monospace', style: { fontFamily: 'monospace' } },
                                ]} />
                            </div>
                            <div className='settings-label'>Use ePub Styles</div>
                            <div className='settings-item'>
                                <input type='checkbox' checked={useEpubStyles} onChange={e => setUseEpubStyles(e.target.checked)} />
                            </div>
                            <div className='settings-label'>Allow Popups</div>
                            <div className='settings-item'>
                                <input type='checkbox' checked={allowPopups} onChange={e => setAllowPopups(e.target.checked)} />
                            </div>
                        </div>
                    </ContextMenu>
                }
                <div className='control-separator'></div>
                <button className='reader-fullscreen-btn' title='Fullscreen' onClick={() => setFullscreen(true)}>
                    <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3'></path></svg>
                </button>
            </div>
        </div >
        :
        <button className='reader-minimize-btn' title='Minimize' onClick={() => setFullscreen(false)}>
            <svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><path d='M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3'></path></svg>
        </button>;

}

export default ReaderHeader;
