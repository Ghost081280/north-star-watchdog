/* ============================================
   NORTH STAR WATCHDOG - CORE MODULE
   Configuration, utilities, and initialization
   ============================================ */

const CONFIG = {
    AI_WORKER: 'https://sweet-paper-d43c.andrew-w-couch.workers.dev',
    CORS_PROXY: 'https://api.allorigins.win/raw?url=',
    USA_SPENDING: 'https://api.usaspending.gov/api/v2',
    PROPUBLICA: 'https://projects.propublica.org/nonprofits/api/v2',
    FEC: 'https://api.open.fec.gov/v1',
    FEC_KEY: 'bhv66hmghpNdcPqd82WMszdJhspXQDKhoqeteL1U'
};

const AI_CHATS = [
    { name: 'ChatGPT', url: 'https://chat.openai.com/' },
    { name: 'Claude', url: 'https://claude.ai/' },
    { name: 'Gemini', url: 'https://gemini.google.com/' },
    { name: 'Grok', url: 'https://grok.x.ai/' },
    { name: 'Perplexity', url: 'https://perplexity.ai/' }
];

// Global data store
let DATA = { 
    news: null, 
    trending: null, 
    investigations: null, 
    figures: null, 
    storyIdeas: null, 
    stats: null,
    redFlags: null
};

// Search state
let currentQuery = '';
let currentResults = {};
let webResearchResults = [];

// ============================================
// UTILITY FUNCTIONS
// ============================================

function esc(s) { 
    if (!s) return ''; 
    const d = document.createElement('div'); 
    d.textContent = s; 
    return d.innerHTML; 
}

function escAttr(s) {
    if (!s) return '';
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function fmt(n) { 
    if (typeof n !== 'number') return n;
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD', 
        minimumFractionDigits: 0 
    }).format(n); 
}

function formatStatus(s) { 
    return { 
        investigating: 'Under Investigation', 
        convicted: 'Convicted', 
        charged: 'Charged',
        sentenced: 'Sentenced',
        indicted: 'Indicted',
        cleared: 'Cleared',
        active: 'Active Official'
    }[s] || s; 
}

// ============================================
// DATA LOADING
// ============================================

async function loadData(filename, key = null) {
    try {
        const res = await fetch(`data/${filename}.json?t=${Date.now()}`);
        if (res.ok) DATA[key || filename] = await res.json();
    } catch (e) { 
        // Silent fail
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    // Load all data files
    await Promise.all([
        loadData('news'), 
        loadData('trending'), 
        loadData('investigations'),
        loadData('figures'), 
        loadData('story-ideas', 'storyIdeas'), 
        loadData('stats'),
        loadData('red-flags', 'redFlags')
    ]);
    
    // Render all sections
    renderBreaking();
    renderStats();
    renderBriefing();
    renderNews();
    renderDetective();
    renderTrending();
    renderStoryIdeas();
    renderInvestigations();
    renderFigures();
    renderQuickSearches();
    updateLastUpdated();
    
    // Setup event handlers
    setupEventListeners();
    setupBackToTop();
    checkUrlParams();
});

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const searchBtn = document.getElementById('search-btn');
    const searchInput = document.getElementById('search-input');
    const exportBtn = document.getElementById('export-btn');
    const closeBtn = document.getElementById('close-results-btn');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', function() {
            doSearch(searchInput.value);
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) { 
            if (e.key === 'Enter') {
                doSearch(this.value);
            }
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportCSV);
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeResults);
    }
}

function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    if (!btn) return;
    
    window.addEventListener('scroll', function() {
        btn.classList.toggle('visible', window.scrollY > 500);
    });
}

function checkUrlParams() {
    const q = new URLSearchParams(location.search).get('q');
    if (q) { 
        const input = document.getElementById('search-input');
        if (input) input.value = q;
        doSearch(q); 
    }
}

// ============================================
// UI HELPERS
// ============================================

function closeResults() {
    const section = document.getElementById('results-section');
    const deepResearch = document.getElementById('deep-research');
    if (section) section.style.display = 'none';
    if (deepResearch) deepResearch.style.display = 'none';
}

function updateLastUpdated() {
    const times = [DATA.news?.lastUpdated, DATA.trending?.lastUpdated].filter(Boolean);
    if (times.length) {
        const latest = new Date(Math.max(...times.map(t => new Date(t))));
        const el = document.getElementById('last-updated-time');
        if (el) el.textContent = latest.toLocaleString();
    }
}

// ============================================
// BRIEFING MODAL
// ============================================

function openBriefing() {
    const modal = document.getElementById('briefing-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeBriefing() {
    const modal = document.getElementById('briefing-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeBriefing();
});

document.addEventListener('click', function(e) {
    if (e.target.classList.contains('briefing-modal')) closeBriefing();
});

// ============================================
// STAT SOURCE MODAL
// ============================================

function showStatSource(label, value, source, url) {
    const existing = document.getElementById('stat-modal');
    if (existing) existing.remove();
    
    const modal = document.createElement('div');
    modal.id = 'stat-modal';
    modal.className = 'stat-modal';
    modal.innerHTML = `
        <div class="stat-modal-content">
            <button class="stat-modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            <h3>${esc(label)}</h3>
            <div class="stat-modal-value">${typeof value === 'number' ? value + '+' : esc(value)}</div>
            <p class="stat-modal-source">Source: ${esc(source || 'Official Records')}</p>
            ${url ? `<a href="${url}" target="_blank" rel="noopener" class="stat-modal-link">View Source</a>` : ''}
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.onclick = function(e) { 
        if (e.target === modal) modal.remove(); 
    };
}

// ============================================
// EXPORT FUNCTION
// ============================================

function exportCSV() {
    const all = Object.values(currentResults).flat();
    
    webResearchResults.forEach(function(a) {
        all.push({ 
            name: a.title, 
            source: a.source, 
            amount: '', 
            description: a.link, 
            status: a.date 
        });
    });
    
    if (!all.length) { 
        alert('No results to export'); 
        return; 
    }
    
    const csv = [
        'Name,Source,Amount,Description,Date/Status', 
        ...all.map(function(r) {
            return `"${(r.name||'').replace(/"/g, '""')}","${r.source||''}","${r.amount||''}","${(r.description||'').replace(/"/g, '""')}","${r.status||r.date||''}"`;
        })
    ].join('\n');
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `north-star-${currentQuery.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// ============================================
// SEARCH TRIGGER (bridges to app-search.js)
// ============================================

function doSearch(query) {
    // Handle various input types
    var searchTerm = '';
    
    if (typeof query === 'string') {
        searchTerm = query.trim();
    } else if (query && typeof query === 'object') {
        // If somehow an event or element was passed
        searchTerm = '';
    }
    
    if (!searchTerm) return;
    
    // Update input field
    var searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = searchTerm;
    }
    
    // Call performSearch from app-search.js
    if (typeof performSearch === 'function') {
        performSearch(searchTerm);
    }
}
