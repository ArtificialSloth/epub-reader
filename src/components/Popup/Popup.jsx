import './Popup.css';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { useEventManager } from '@/context/EventManagerContext';

function Popup({ onConfirm, onClose, children }) {
    const eventManager = useEventManager();

    useEffect(() => {
        function onKeyDown(e) {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter') onConfirm();
        }
        eventManager.add('keydown', onKeyDown);
        return () => eventManager.remove('keydown', onKeyDown);
    }, [onClose]);

    return createPortal(
        <div className='popup-overlay' onMouseDown={onClose} onContextMenu={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className='popup' onMouseDown={e => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}

export default Popup;
