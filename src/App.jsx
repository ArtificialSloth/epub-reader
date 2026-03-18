import { useEffect } from 'react'
import Library from './pages/Library/Library'
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'

function App() {
    useEffect(() => {
        const win = getCurrentWindow();
        win.setSize(new LogicalSize(screen.width * 0.8, screen.height * 0.8));
    }, []);
    
    return <Library />;
}

export default App