import { createContext, useContext, useState } from 'react'

const PageContext = createContext();

export function PageProvider({ children }) {
    const [page, setPage] = useState({ name: 'library' });

    function navigate(name, props = {}) {
        setPage({ name, ...props });
    }

    return (
        <PageContext.Provider value={{ page, navigate }}>
            {children}
        </PageContext.Provider>
    );
}

export function usePage() {
    return useContext(PageContext);
}
