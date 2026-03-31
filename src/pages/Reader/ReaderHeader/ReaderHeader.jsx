import './ReaderHeader.css';
import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { usePage } from '@/context/PageContext';
import ContextMenu from '@/components/ContextMenu';
import Select from '@/components/Select';

function ReaderHeader({ backBtnRef, fontSize, setFontSize, fontFamily, setFontFamily, useEpubStyles, setUseEpubStyles, allowPopups, setAllowPopups }) {
    const { navigate } = usePage();

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [menuPos, setMenuPos] = useState(null);

    const settingsBtnRef = useRef(null);

    useEffect(() => {
        getCurrentWindow().isFullscreen().then(setIsFullscreen);
    }, []);

    useEffect(() => {
        function onBlur() { if (menuPos && document.activeElement?.tagName === 'FOLIATE-VIEW') setMenuPos(null); }
        if (menuPos) window.addEventListener('blur', onBlur);
        else window.removeEventListener('blur', onBlur);
        return () => window.removeEventListener('blur', onBlur);
    }, [menuPos]);

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
