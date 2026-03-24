import './Popup.css';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

function Popup({ onConfirm, onClose, children }) {
    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') onConfirm();
        }
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return createPortal(
        <div className='popup-overlay' onMouseDown={onClose} onContextMenu={e => e.stopPropagation()} onClick={e => e.stopPropagation(e)}>
            <div className='popup' onMouseDown={e => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default Popup;
