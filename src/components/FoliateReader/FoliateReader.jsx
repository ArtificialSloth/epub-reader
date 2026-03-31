import { useRef, useEffect } from 'react';
import '@/lib/foliate-js/view.js';

function FoliateReader({ bookData, lastLocation, viewRef, onInit, onLoad, onRelocate, onRelocated }) {
    const containerRef = useRef(null);

    useEffect(() => {
        const container = containerRef.current;
        const view = document.createElement('foliate-view');

        const onResize = () => view?.renderer?.setAttribute('max-inline-size', `${container.clientWidth / 2}px`);
        const observer = new ResizeObserver(([entry]) => {
            observer.disconnect();
            viewRef.current = view;
            container.appendChild(view);

            view.addEventListener('load', e => {
                container.style.opacity = 0;
                onLoad(e);
            });

            view.addEventListener('relocate', e => {
                onRelocate(e);
                clearTimeout(viewRef._relocateTimeout);
                viewRef._relocateTimeout = setTimeout(() => {
                    container.style.opacity = 1;
                    onRelocated(e);
                }, 50);
            });

            view.open(bookData)
                .then(() => view.init({ lastLocation }))
                .then(() => {
                    view.renderer.setAttribute('max-inline-size', `${container.clientWidth / 2}px`);
                    window.addEventListener('resize', onResize);
                    onInit();
                }).catch(err => console.error(err));
        });
        observer.observe(container);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', onResize);

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
