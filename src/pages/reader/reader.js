const { invoke } = window.__TAURI__.core;
const { getCurrentWindow } = window.__TAURI__.window;

const state = {
    identifier: null,
    book: null,
    chapter: 0,
    page: 0,
    totalPages: 0,
    fontSize: parseInt(localStorage.getItem('reader-font-size') || '18'),
    fontFamily: localStorage.getItem('reader-font-family') || 'serif',
    isFullscreen: false,
};

let currentChapterHTML = '';
let stride = 0;
let anchorPath = null;

let saveTimer = null;
let repaginateTimer = null;
let resizeObserver = null;
let skipNextResize = false;
let keyDownHandler = null;
let docClickHandler = null;
let onBackCallback = null;

export async function initReader(identifier, book, onBack) {
    state.identifier = identifier;
    state.book = book;
    state.chapter = book.current_chapter ?? 0;
    state.page = 0;
    onBackCallback = onBack;

    document.getElementById('reader-page').innerHTML = buildHTML();
    await getCurrentWindow().setTitle(book.title);

    setupEvents();
    startArrowFade();
    await loadChapter(state.chapter, book.current_position ?? 0);
}

export async function cleanupReader() {
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }
    if (keyDownHandler) { document.removeEventListener('keydown', keyDownHandler); keyDownHandler = null; }
    if (docClickHandler) { document.removeEventListener('click', docClickHandler); docClickHandler = null; }
    clearTimeout(saveTimer);
    clearTimeout(repaginateTimer);
    currentChapterHTML = '';
    if (state.isFullscreen) {
        state.isFullscreen = false;
        await getCurrentWindow().setFullscreen(false);
    }
}

function buildHTML() {
    return `
        <header id="reader-header">
            <button id="reader-back-btn" class="reader-icon-btn" title="Back to library">
                <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
                    <path d="M13 4L7 10L13 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div id="reader-header-right">
                <button id="reader-font-btn" class="reader-icon-btn reader-font-icon" title="Font settings">Aa</button>
                <button id="reader-fullscreen-btn" class="reader-icon-btn" title="Fullscreen">
                    <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                        <path d="M1 6V1H6M12 1H17V6M17 12V17H12M6 17H1V12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </div>
        </header>

        <div id="reader-body">
            <div id="reader-prev-zone" class="reader-nav-zone" title="Previous page">
                <div class="reader-nav-arrow">&#8249;</div>
            </div>
            <div id="reader-columns-wrapper">
                <div id="reader-columns"></div>
            </div>
            <div id="reader-next-zone" class="reader-nav-zone" title="Next page">
                <div class="reader-nav-arrow">&#8250;</div>
            </div>
        </div>

        <div id="reader-page-label"></div>

        <footer id="reader-footer">
            <div id="reader-progress-bar"></div>
        </footer>

        <div id="reader-font-menu" class="reader-font-menu hidden">
            <div class="font-menu-row">
                <span class="font-menu-label">Size</span>
                <div class="font-menu-controls">
                    <button class="font-size-btn" id="font-size-dec">A−</button>
                    <span id="font-size-display">${state.fontSize}px</span>
                    <button class="font-size-btn" id="font-size-inc">A+</button>
                </div>
            </div>
            <div class="font-menu-row">
                <span class="font-menu-label">Style</span>
                <div class="font-menu-controls">
                    <button class="font-family-btn${state.fontFamily === 'serif' ? ' active' : ''}" data-family="serif" style="font-family: serif">Serif</button>
                    <button class="font-family-btn${state.fontFamily === 'sans-serif' ? ' active' : ''}" data-family="sans-serif" style="font-family: sans-serif">Sans</button>
                    <button class="font-family-btn${state.fontFamily === 'monospace' ? ' active' : ''}" data-family="monospace" style="font-family: monospace">Mono</button>
                </div>
            </div>
        </div>

        <button id="reader-fullscreen-exit" class="reader-icon-btn" title="Exit fullscreen">
            <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
                <path d="M6 1V6H1M17 6H12V1M1 12H6V17M12 17V12H17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </button>
    `;
}

// ===== Pagination =====

async function loadChapter(chapterIndex, initialPosition = 0) {
    state.chapter = chapterIndex;
    state.totalPages = 0;

    const cols = document.getElementById('reader-columns');
    cols.style.transform = 'none';
    cols.innerHTML = '<div class="reader-loading">Loading\u2026</div>';

    let html;
    try {
        html = await invoke('get_chapter', { index: chapterIndex });
    } catch {
        cols.innerHTML = '<div class="reader-error">Failed to load chapter.</div>';
        return;
    }

    currentChapterHTML = html;
    await paginate(html);

    const target = initialPosition === 'last'
        ? state.totalPages - 1
        : Math.min(initialPosition, state.totalPages - 1);
    goToPage(target);
    buildProgressBar();
    reconnectObserver();
}

async function paginate(html) {
    if (resizeObserver) resizeObserver.disconnect();
    clearTimeout(repaginateTimer);

    const wrapper = document.getElementById('reader-columns-wrapper');
    const cols = document.getElementById('reader-columns');
    if (!cols || !wrapper) return;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script').forEach(el => el.remove());
    doc.querySelectorAll('img, image, svg').forEach(img => {
        //img.removeAttribute('width');
        //img.removeAttribute('height');
        img.style.maxWidth = '100%';
        img.style.maxHeight = `${Math.floor(cols.clientHeight * 0.9)}px`;
    });

    cols.style.transform = 'none';
    cols.innerHTML = doc.body.innerHTML;
    applyFont();

    // Wait for images to load before measuring scrollWidth
    const imgs = [...cols.querySelectorAll('img')];
    if (imgs.length) {
        await Promise.allSettled(imgs.map(img =>
            img.complete ? Promise.resolve()
                         : new Promise(r => { img.onload = r; img.onerror = r; })
        ));
    }

    cols.offsetWidth; // force reflow

    const gap = parseFloat(getComputedStyle(cols).columnGap) || 0;
    stride = cols.offsetWidth + gap;
    state.totalPages = Math.max(1, Math.round((cols.scrollWidth + gap) / stride));
}

function goToPage(n) {
    const cols = document.getElementById('reader-columns');
    if (!cols) return;
    state.page = Math.max(0, Math.min(n, state.totalPages - 1));
    cols.style.transform = `translateX(${-state.page * stride}px)`;
    cols.offsetWidth; // flush styles so elementFromPoint reflects new transform
    anchorPath = getAnchorPath();
    updateLabel();
    scheduleSave();
}

// ===== Navigation =====

function goToPrev() {
    if (state.page > 0) {
        goToPage(state.page - 1);
    } else if (state.chapter > 0) {
        loadChapter(state.chapter - 1, 'last');
    }
}

function goToNext() {
    if (state.page < state.totalPages - 1) {
        goToPage(state.page + 1);
    } else if (state.chapter < state.book.num_chapters - 1) {
        loadChapter(state.chapter + 1, 0);
    }
}

// ===== Progress =====

function updateLabel() {
    const el = document.getElementById('reader-page-label');
    if (!el) return;
    const numChapters = state.book.num_chapters || 1;
    const pct = Math.round(
        ((state.chapter + Math.min(1, state.page / Math.max(1, state.totalPages))) / numChapters) * 100
    );
    el.textContent = `${state.page + 1} / ${state.totalPages}  (${pct}%)`;
}

function buildProgressBar() {
    const bar = document.getElementById('reader-progress-bar');
    if (!bar) return;
    const n = state.book.num_chapters;
    bar.replaceChildren();
    for (let i = 0; i < n; i++) {
        const sec = document.createElement('div');
        sec.className = 'progress-section';
        if (i < state.chapter) sec.classList.add('progress-section--past');
        if (i === state.chapter) sec.classList.add('progress-section--current');

        const tip = document.createElement('div');
        tip.className = 'progress-tooltip';
        tip.textContent = `${i + 1} / ${n}`;
        sec.appendChild(tip);

        const idx = i;
        sec.addEventListener('click', () => { if (idx !== state.chapter) loadChapter(idx, 0); });
        bar.appendChild(sec);
    }
}

// ===== Font =====

function applyFont() {
    const cols = document.getElementById('reader-columns');
    if (cols) {
        cols.style.fontSize = `${state.fontSize}px`;
        cols.style.fontFamily = state.fontFamily;
    }
}

function reconnectObserver() {
    const w = document.getElementById('reader-columns-wrapper');
    if (resizeObserver && w) {
        skipNextResize = true;
        resizeObserver.observe(w);
    }
}

// Scans downward from the top of the visible content area until elementFromPoint
// returns something inside cols, then records its full child-index path from cols.
// Using a deep element (e.g. <p>) rather than a direct child avoids large wrapper
// divs whose getBoundingClientRect spans all pages.
function getAnchorPath() {
    const cols = document.getElementById('reader-columns');
    const wrapper = document.getElementById('reader-columns-wrapper');
    if (!cols || !wrapper) return null;

    const wRect = wrapper.getBoundingClientRect();
    const cs = getComputedStyle(wrapper);
    const x = wRect.left + parseFloat(cs.paddingLeft) + 2;
    const yTop = wRect.top + parseFloat(cs.paddingTop);
    const yBottom = wRect.bottom - parseFloat(cs.paddingBottom);

    let target = null;
    for (let y = yTop + 1; y < yBottom; y += 4) {
        const el = document.elementFromPoint(x, y);
        if (el && el !== cols && cols.contains(el)) { target = el; break; }
    }
    if (!target) return null;

    const path = [];
    let cur = target;
    while (cur && cur !== cols) {
        const parent = cur.parentElement;
        if (!parent) return null;
        path.unshift([...parent.children].indexOf(cur));
        cur = parent;
    }
    return path;
}

// After paginate() (transform: none), follows the path to the same element
// and returns which page it now falls on.
function pageForPath(path) {
    const cols = document.getElementById('reader-columns');
    if (!cols || !stride) return 0;
    let el = cols;
    for (const i of path) {
        if (!el.children[i]) return 0;
        el = el.children[i];
    }
    const naturalLeft = el.getBoundingClientRect().left - cols.getBoundingClientRect().left;
    return Math.max(0, Math.min(Math.floor(naturalLeft / stride), state.totalPages - 1));
}

async function repaginate() {
    if (!currentChapterHTML) return;
    const path = anchorPath;
    const ratio = state.totalPages > 1 ? state.page / (state.totalPages - 1) : 0;
    await paginate(currentChapterHTML);
    goToPage(path ? pageForPath(path) : Math.round(ratio * (state.totalPages - 1)));
    reconnectObserver();
}

// ===== Fullscreen =====

async function toggleFullscreen() {
    state.isFullscreen = !state.isFullscreen;
    await getCurrentWindow().setFullscreen(state.isFullscreen);
    document.getElementById('reader-page').classList.toggle('fullscreen', state.isFullscreen);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    await repaginate();
}

// ===== Misc =====

function startArrowFade() {
    const page = document.getElementById('reader-page');
    page.classList.add('arrows-faded');
    for (const id of ['reader-prev-zone', 'reader-next-zone']) {
        const zone = document.getElementById(id);
        zone.addEventListener('mouseenter', () => page.classList.remove('arrows-faded'));
        zone.addEventListener('mouseleave', () => page.classList.add('arrows-faded'));
    }
}

function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
        try {
            await invoke('save_progress', {
                identifier: state.identifier,
                chapterIndex: state.chapter,
                positionIndex: state.page,
            });
        } catch (e) {
            console.error('save_progress failed:', e);
        }
    }, 500);
}

// ===== Events =====

function setupEvents() {
    const $ = id => document.getElementById(id);

    $('reader-back-btn').addEventListener('click', async () => {
        clearTimeout(saveTimer);
        try {
            await invoke('save_progress', {
                identifier: state.identifier,
                chapterIndex: state.chapter,
                positionIndex: state.page,
            });
        } catch {}
        await invoke('close_book');
        await cleanupReader();
        document.getElementById('reader-page').replaceChildren();
        onBackCallback?.();
    });

    $('reader-fullscreen-btn').addEventListener('click', toggleFullscreen);
    $('reader-fullscreen-exit').addEventListener('click', toggleFullscreen);

    $('reader-font-btn').addEventListener('click', e => {
        e.stopPropagation();
        $('reader-font-menu').classList.toggle('hidden');
    });

    $('reader-prev-zone').addEventListener('click', goToPrev);
    $('reader-next-zone').addEventListener('click', goToNext);

    // Intercept epub internal links
    $('reader-columns').addEventListener('click', e => {
        const link = e.target.closest('a[href]');
        if (!link) return;
        e.preventDefault();
        // TODO: resolve href to chapter index + fragment and navigate
    });

    $('font-size-dec').addEventListener('click', async () => {
        if (state.fontSize <= 12) return;
        state.fontSize--;
        localStorage.setItem('reader-font-size', state.fontSize);
        $('font-size-display').textContent = `${state.fontSize}px`;
        await repaginate();
    });

    $('font-size-inc').addEventListener('click', async () => {
        if (state.fontSize >= 36) return;
        state.fontSize++;
        localStorage.setItem('reader-font-size', state.fontSize);
        $('font-size-display').textContent = `${state.fontSize}px`;
        await repaginate();
    });

    document.querySelectorAll('.font-family-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            state.fontFamily = btn.dataset.family;
            localStorage.setItem('reader-font-family', state.fontFamily);
            document.querySelectorAll('.font-family-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            await repaginate();
        });
    });

    keyDownHandler = e => {
        const readerPage = document.getElementById('reader-page');
        if (!readerPage || readerPage.style.display === 'none') return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); goToNext(); }
        else if (e.key === 'Escape' && state.isFullscreen) toggleFullscreen();
    };
    document.addEventListener('keydown', keyDownHandler);

    docClickHandler = e => {
        const menu = $('reader-font-menu');
        const btn = $('reader-font-btn');
        if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && !btn?.contains(e.target)) {
            menu.classList.add('hidden');
        }
    };
    document.addEventListener('click', docClickHandler);

    resizeObserver = new ResizeObserver(() => {
        if (skipNextResize) { skipNextResize = false; return; }
        clearTimeout(repaginateTimer);
        repaginateTimer = setTimeout(() => repaginate(), 150);
    });
    resizeObserver.observe($('reader-columns-wrapper'));
}
