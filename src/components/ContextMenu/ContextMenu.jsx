import './ContextMenu.css';
import { createPortal } from 'react-dom';
import { useEffect, useLayoutEffect, useRef } from 'react';

function ContextMenu({ parentRef, x, y, onClose, children }) {
    const ref = useRef(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth)
            el.style.left = `${x - rect.width}px`;
        if (rect.bottom > window.innerHeight)
            el.style.top = `${y - rect.height}px`;
    }, [x, y]);

    useEffect(() => {
        function handleOutside(e) {
            if (!parentRef.current.contains(e.target)) onClose();
        }
        function handleEsc(e) { if (e.key === 'Escape') onClose(); }
        document.addEventListener('mousedown', handleOutside);
        document.addEventListener('keydown', handleEsc);
        return () => {
            document.removeEventListener('mousedown', handleOutside);
            document.removeEventListener('keydown', handleEsc);
        };
    }, [onClose]);

    return createPortal(
        <div ref={ref} className='context-menu' style={{ left: x, top: y }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation(e)}>
            {children}
        </div>,
        document.body
    );
}

export default ContextMenu;
