import { useEffect } from 'react'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { PageProvider, usePage } from './PageContext'
import Library from './pages/Library/Library'
import Reader from './pages/Reader/Reader'

function Routes() {
    const { page } = usePage();
    switch (page.name) {
        case 'library': return <Library />;
        case 'reader': return <Reader identifier={page.identifier} book={page.book} />;
        default: return <Library />;
    };
}

function App() {
    useEffect(() => {
        const win = getCurrentWindow();
        win.setSize(new LogicalSize(screen.width * 0.8, screen.height * 0.8));
    }, []);

    return (
        <PageProvider>
            <Routes />
        </PageProvider>
    );
}

export default App
