import { createContext, useContext, useState } from 'react';

const PageContext = createContext();

export function PageProvider({ initPage, children }) {
    const [page, setPage] = useState(initPage);

    function navigate(name, props = {}) {
        setPage({ name, ...props });
    }

    return (
        <PageContext.Provider value={{ page, navigate }}>
            {children}
        </PageContext.Provider>
    );
}

export const usePage = () => useContext(PageContext);
