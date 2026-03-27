import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getMatches } from '@tauri-apps/plugin-cli';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { PageProvider, usePage } from '@/context/PageContext';
import { CustomStylesProvider } from '@/context/CustomStylesContext';
import Library from '@/pages/Library';
import Reader from '@/pages/Reader';

function Routes() {
    const { page } = usePage();
    switch (page.name) {
        case 'library': return <Library />;
        case 'reader': return <Reader identifier={page.identifier} book={page.book} />;
        default: return <Library />;
    };
}

function App() {
    const [initPage, setInitPage] = useState(null);
    const [customStyles, setCustomStyles] = useState(null);

    useEffect(() => {
        async function init() {
            const win = getCurrentWindow();
            await win.setSize(new LogicalSize(screen.width * 0.8, screen.height * 0.8));

            const styles = await invoke('get_custom_styles').then(css => {
                const marker = '/* @epub */';
                const idx = css.indexOf(marker);
                return idx === -1 ? { app: css, epub: '' } : { app: css.slice(0, idx), epub: css.slice(idx + marker.length) };
            }).catch(err => {
                console.error(err);
                return { app: '', epub: '' };
            });

            if (styles.app) {
                const el = document.createElement('style');
                el.textContent = styles.app;
                document.head.appendChild(el);
            }
            setCustomStyles(styles);

            const matches = await getMatches();
            if (matches.args.open?.value) {
                await invoke('add_book', { path: matches.args.open?.value })
                    .then(identifier => invoke('open_book', { identifier })
                        .then(book => setInitPage({ name: 'reader', identifier, book })))
                    .catch(err => {
                        console.error(err);
                        setInitPage({ name: 'library' });
                    });
            } else {
                setInitPage({ name: 'library' });
            }
        }
        init();
    }, []);
    if (!initPage || !customStyles) return null;

    return (
        <PageProvider initPage={initPage}>
            <CustomStylesProvider customStyles={customStyles}>
                <Routes />
            </CustomStylesProvider>
        </PageProvider>
    );
}

export default App;
