import './Header.css'

function Header({ left, right }) {
    return (
        <header className='header'>
            <div className='header-left'>{left}</div>
            <div className='header-right'>{right}</div>
        </header>
    );
}

export default Header
