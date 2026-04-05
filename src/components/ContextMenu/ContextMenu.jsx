import './ContextMenu.css';
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useEventManager } from '@/context/EventManagerContext';

function ContextMenu({ parentRef, x, y, onClose, children }) {
    const eventManager = useEventManager();
    const menuRef = useRef(null);

    useLayoutEffect(() => {
        const menu = menuRef.current;
        if (!menu) return;

        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) menu.style.left = `${x - rect.width}px`;
        if (rect.bottom > window.innerHeight) menu.style.top = `${y - rect.height}px`;
    }, [x, y]);

    useEffect(() => {
        function onMouseDown(e) { if (!parentRef.current?.contains(e.target)) onClose(); }
        function onKeyDown(e) { if (e.key === 'Escape') onClose(); }

        eventManager.add('mousedown', onMouseDown);
        eventManager.add('keydown', onKeyDown);
        return () => {
            eventManager.remove('mousedown', onMouseDown);
            eventManager.remove('keydown', onKeyDown);
        };
    }, [onClose]);

    return createPortal(
        <div ref={menuRef} className='context-menu' style={{ left: x, top: y }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            {children}
        </div>,
        document.body
    );
}

export default ContextMenu;
