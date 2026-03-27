import './TableOfContents.css';
import { useState, useEffect, Fragment } from 'react';

function TableOfContents({ viewRef, expandToc, setExpandToc, backBtnRef }) {
    useEffect(() => {
        function onMouseDown(e) { if (!backBtnRef.current?.contains(e.target)) setExpandToc(false); }
        function onKeyDown(e) { if (e.key === 'Escape') setExpandToc(false); }
        function onBlur() { if (expandToc && document.activeElement?.tagName === 'FOLIATE-VIEW') setExpandToc(false); }
        function removeListeners() {
            document.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('blur', onBlur);
        }

        if (expandToc) {
            document.addEventListener('mousedown', onMouseDown);
            document.addEventListener('keydown', onKeyDown);
            window.addEventListener('blur', onBlur);
        } else removeListeners();
        return () => removeListeners();
    }, [expandToc]);

    function onClickTocItem(tocItem) {
        viewRef.current?.goTo(tocItem.href);
        setExpandToc(!expandToc);
    }

    const renderTocItems = (items, depth = 0) =>
        items?.map((entry, index) => (
            <Fragment key={`${depth}-${index}`}>
                <button className='toc-item' style={{ paddingLeft: `${32 + depth * 16}px` }} onClick={() => onClickTocItem(entry)}>
                    {entry.label}
                </button>
                {entry.subitems && renderTocItems(entry.subitems, depth + 1)}
            </Fragment>
        ));

    return viewRef.current?.book?.toc?.length > 0 &&
        <div className='reader-toc'>
            <div className='toc-container' onWheel={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
                {renderTocItems(viewRef.current?.book.toc)}
            </div>
            <button className='toc-btn' onClick={() => setExpandToc(!expandToc)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            </button>
        </div>;
}

export default TableOfContents;
