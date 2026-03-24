import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getMatches } from '@tauri-apps/plugin-cli';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { PageProvider, usePage } from './PageContext';
import Library from './pages/Library';
import Reader from './pages/Reader';

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

    useEffect(() => {
        async function init() {
            const win = getCurrentWindow();
            await win.setSize(new LogicalSize(screen.width * 0.8, screen.height * 0.8));

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
    if (!initPage) return null;

    return (
        <PageProvider initPage={initPage}>
            <Routes />
        </PageProvider>
    );
}

export default App;
