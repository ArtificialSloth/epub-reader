import { useRef, useEffect } from 'react';
import '@/lib/foliate-js/view.js';

function FoliateReader({ bookData, lastLocation, containerRef, viewRef, onLoad, onRelocate }) {
    useEffect(() => {
        const container = containerRef.current;
        const view = document.createElement('foliate-view');

        const observer = new ResizeObserver(([entry]) => {
            const { w, h } = entry.contentRect;
            if (w === 0 || h === 0) return;

            observer.disconnect();
            viewRef.current = view;
            container.appendChild(view);

            view.addEventListener('load', onLoad);
            view.addEventListener('relocate', onRelocate);

            view.open(bookData)
                .then(() => view.init({ lastLocation }))
                .catch(err => console.error(err));
        });
        observer.observe(container);

        return () => {
            observer.disconnect();

            function suppress(e) { if (e.message?.includes('cannot be destructured')) e.preventDefault(); };
            window.addEventListener('error', suppress);
            view.close();
            view.remove();
            viewRef.current = null;

            setTimeout(() => window.removeEventListener('error', suppress), 200);
        };
    }, [bookData]);

    return <div ref={containerRef} className='foliate-container' style={{ width: '100%', height: '100%', opacity: 0 }} />;
}

export default FoliateReader;
