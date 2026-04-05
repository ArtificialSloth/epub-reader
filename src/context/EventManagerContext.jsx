import { createContext, useContext, useRef } from 'react';

const EventManagerContext = createContext(null);

export function EventManagerProvider({ children }) {
    const listenersRef = useRef([]);
    const iFrameDocRef = useRef(null);

    const manager = useRef({
        setIFrame(doc) {
            listenersRef.current.forEach(([type, handler]) => {
                iFrameDocRef.current?.removeEventListener(type, handler);
                doc?.addEventListener(type, handler);
            });
            iFrameDocRef.current = doc;
        },
        add(type, handler) {
            listenersRef.current.push([type, handler]);
            document.addEventListener(type, handler);
            iFrameDocRef.current?.addEventListener(type, handler);
        },
        remove(type, handler) {
            listenersRef.current = listenersRef.current.filter(([, h]) => h !== handler);
            document.removeEventListener(type, handler);
            iFrameDocRef.current?.removeEventListener(type, handler);
        }
    });

    return <EventManagerContext.Provider value={manager.current}>{children}</EventManagerContext.Provider>;
}

export const useEventManager = () => useContext(EventManagerContext);
