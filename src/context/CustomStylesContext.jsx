import { createContext, useContext } from 'react';

const CustomStylesContext = createContext({ app: '', epub: '' });

export function CustomStylesProvider({ customStyles, children }) {
    return (
        <CustomStylesContext.Provider value={customStyles}>
            {children}
        </CustomStylesContext.Provider>
    );
}

export function useCustomStyles() {
    return useContext(CustomStylesContext);
}
