import { useState, useEffect } from 'react';

export function useBookSetting(identifier, key) {
    const storageKey = `${identifier}:${key}`;
    const [value, setValue] = useState(() => localStorage.getItem(storageKey) === 'true');

    useEffect(() => {
        if (value) localStorage.setItem(storageKey, value);
        else localStorage.removeItem(storageKey);
    }, [value, storageKey]);

    return [value, setValue];
}
