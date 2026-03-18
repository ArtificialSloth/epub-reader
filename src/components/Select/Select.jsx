import './Select.css'

const textPrimary = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim();
const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${textPrimary}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;


function Select({value, onChange, children}) {
    return (
        <select value={value} onChange={onChange} style={{backgroundImage: `url('data:image/svg+xml,${encodeURIComponent(arrowSvg)}')`}}>
            {children}
        </select>
    );
}

export default Select