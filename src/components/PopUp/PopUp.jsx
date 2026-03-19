import './PopUp.css'
import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'

function PopUp({ onConfirm, onClose, children }) {
    useEffect(() => {
        function handleKey(e) {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') onConfirm();
        }
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    return createPortal(
        <div className='popup-overlay' onMouseDown={onClose} onContextMenu={e => e.stopPropagation()}>
            <div className='popup' onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default PopUp
