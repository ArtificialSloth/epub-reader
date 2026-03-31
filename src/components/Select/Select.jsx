import './Select.css';
import { useState, useRef, useLayoutEffect } from 'react';

function Select({ value, setValue, options }) {
    const [showOptions, setShowOptions] = useState(false);
    const [minWidth, setMinWidth] = useState(null);
    const optionsRef = useRef(null);

    useLayoutEffect(() => {
        if (optionsRef.current) setMinWidth(optionsRef.current.clientWidth);
    }, []);

    function onClickDropdown(e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.buttons === 1) setShowOptions(!showOptions);
    }

    function onClickOption(e) {
        e.stopPropagation();
        setShowOptions(false);
        setValue(e.target.getAttribute('value'));
    }

    const selected = options.find(option => option.value === value) || options[0];

    return (
        <div className={`select ${showOptions ? 'active' : ''}`}>
            <div className='select-dropdown' style={{ minWidth: minWidth }} onMouseDown={onClickDropdown}>
                <div className='label' style={selected.style}>
                    {selected.label}
                </div>
                {!showOptions ?
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
                    :
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6" /></svg>
                }
            </div>
            <div ref={optionsRef} className='select-options'>
                {options.map((option, index) => <div key={index} className='option' style={option.style} value={option.value} onClick={onClickOption}>{option.label}</div>)}
            </div>
        </div>
    );
}

export default Select;
