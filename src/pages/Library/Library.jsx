import './Library.css'
import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import Select from '@/components/Select/Select'
import BookCard from './BookCard/BookCard'

function Library() {
    const [sort, setSort] = useState(localStorage.getItem('sort') ?? 'recently-added');
    const [library, setLibrary] = useState('loading');

    async function fetchLibrary() {
        await invoke('get_library').then(setLibrary).catch(err => {
            console.error(err);
            setLibrary(String(err));
        });
    }
    useEffect(() => { fetchLibrary(); }, []);

    async function addBook() {
        const paths = await open({
            multiple: true,
            filters: [{ name: 'Epub Files', extensions: ['epub'] }]
        });
        if (!paths || paths.length === 0) return;
        await Promise.all(paths.map(path => invoke('add_book', { path })));
        await fetchLibrary();
    }

    async function removeBook(identifier) {
        if (!identifier) return;
        await invoke('remove_book', { identifier });
        await fetchLibrary();
    }

    function onChange(e) {
        const value = e.target.value;
        localStorage.setItem('sort', value);
        setSort(value);
    }

    function sortedEntries() {
        const entries = Object.entries(library);
        switch (sort) {
            case 'recently-added': return entries.sort(([, a], [, b]) => b.added - a.added);
            case 'recently-read': return entries.sort(([, a], [, b]) => b.opened - a.opened);
            case 'a-z': return entries.sort(([, a], [, b]) => a.title.localeCompare(b.title));
            case 'z-a': return entries.sort(([, a], [, b]) => b.title.localeCompare(a.title));
            default: return entries;
        }
    }

    return (
        <div className='library'>
            <div className='library-header'>
                <h1>My Library</h1>
                <div className='library-controls'>
                    <Select value={sort} onChange={onChange}>
                        <option value='recently-added'>Recently Added</option>
                        <option value='recently-read'>Recently Read</option>
                        <option value='a-z'>A-Z</option>
                        <option value='z-a'>Z-A</option>
                    </Select>
                    <button onClick={addBook}>+ Add Book</button>
                </div>
            </div>
            {(() => {
                if (library === 'loading') return (<div className='loader-wrapper'><div className='loader'></div></div>);
                else if (typeof library === 'string') return (
                    <div className='library-error'>
                        <p className='error-label'>There was an error loading your library:</p>
                        <p className='error-text'>{library}</p>
                    </div>
                );
                else if (Object.entries(library).length === 0) return <div className='library-empty'>No books yet. Click <strong>+ Add Book</strong> to get started.</div>;
                else return (
                    <div className='library-grid'>
                        {sortedEntries().map(([identifier, book]) => (
                            <BookCard key={identifier} identifier={identifier} book={book} onRemove={removeBook} />
                        ))}
                    </div>
                );
            })()}
        </div>
    );
}

export default Library
