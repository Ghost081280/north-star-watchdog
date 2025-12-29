/* ============================================
   NORTH STAR WATCHDOG V5 - NO API KEYS NEEDED
   
   - Site auto-updates hourly via AI (GitHub Actions)
   - User searches get web research links
   - "Take to Your AI" - opens ChatGPT/Claude/Gemini/Grok
   - Zero friction, zero API keys for users
   ============================================ */

const CONFIG = {
    CORS_PROXY: 'https://api.allorigins.win/raw?url=',
    USA_SPENDING: 'https://api.usaspending.gov/api/v2',
    PROPUBLICA: 'https://projects.propublica.org/nonprofits/api/v2',
    FEC: 'https://api.open.fec.gov/v1',
    FEC_KEY: 'bhv66hmghpNdcPqd82WMszdJhspXQDKhoqeteL1U'
};

// AI chat URLs - user picks their favorite
const AI_CHATS = {
    chatgpt: { name: 'ChatGPT', url: 'https://chat.openai.com/', icon: '🤖' },
    claude: { name: 'Claude', url: 'https://claude.ai/', icon: '🧠' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: '✨' },
    grok: { name: 'Grok', url: 'https://grok.x.ai/', icon: '🚀' },
    perplexity: { name: 'Perplexity', url: 'https://perplexity.ai/', icon: '🔍' }
};

// Deep research sources
const RESEARCH_SOURCES = [
    { name: 'DOJ Minnesota', url: 'https://www.google.com/search?q=site:justice.gov/usao-mn+', icon: '⚖️' },
    { name: 'Google News', url: 'https://news.google.com/search?q=', icon: '📰' },
    { name: 'Court Listener', url: 'https://www.courtlistener.com/?q=', icon: '🏛️' },
    { name: 'MPR News', url: 'https://www.google.com/search?q=site:mprnews.org+', icon: '📻' },
    { name: 'Star Tribune', url: 'https://www.google.com/search?q=site:startribune.com+', icon: '📰' },
    { name: 'FOX 9', url: 'https://www.google.com/search?q=site:fox9.com+', icon: '📺' },
    { name: 'KSTP', url: 'https://www.google.com/search?q=site:kstp.com+', icon: '📺' },
    { name: 'House Oversight', url: 'https://www.google.com/search?q=site:oversight.house.gov+minnesota+', icon: '🏛️' }
];

let DATA = { news: null, trending: null, investigations: null, figures: null, storyIdeas: null };
let currentQuery = '';
let currentResults = {};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c⭐ North Star Watchdog V5', 'color:#d4af37;font-size:20px;font-weight:bold');
    console.log('%c🚀 Zero API Keys Needed!', 'color:#22c55e');
    
    await Promise.all([
        loadData('news'), loadData('trending'), loadData('investigations'),
        loadData('figures'), loadData('story-ideas', 'storyIdeas')
    ]);
    
    renderBreaking();
    renderNews();
    renderTrending();
    renderStoryIdeas();
    renderInvestigations();
    renderFigures();
    renderQuickSearches();
    updateLastUpdated();
    setupEventListeners();
    checkUrlParams();
});

async function loadData(filename, key = null) {
    try {
        const res = await fetch(`data/${filename}.json?t=${Date.now()}`);
        if (res.ok) DATA[key || filename] = await res.json();
    } catch (e) {}
}

// ============================================
// RENDER SECTIONS (same as V4)
// ============================================
function renderBreaking() {
    if (!DATA.news?.breaking) return;
    document.getElementById('breaking-text').textContent = DATA.news.breaking.title;
    document.getElementById('breaking-source').href = DATA.news.breaking.link || '#';
}

function renderNews() {
    const grid = document.getElementById('news-grid');
    if (!DATA.news?.articles?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.news.articles.slice(0, 8).map(a => `
        <div class="news-card">
            <div class="news-source">${a.source}</div>
            <h3 class="news-title"><a href="${a.link}" target="_blank">${a.title}</a></h3>
            <div class="news-date">${a.date}</div>
        </div>
    `).join('');
}

function renderTrending() {
    const grid = document.getElementById('trending-grid');
    if (!DATA.trending?.topics?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.trending.topics.map(t => `
        <div class="trending-card">
            <h3 class="trending-topic">${t.topic}</h3>
            <p class="trending-reason">${t.reason}</p>
            <div class="trending-searches">
                ${t.suggestedSearches.map(s => `<span class="search-tag" onclick="doSearch('${esc(s)}')">${s}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderStoryIdeas() {
    const grid = document.getElementById('stories-grid');
    if (!DATA.storyIdeas?.ideas?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.storyIdeas.ideas.map(idea => `
        <div class="story-card">
            <span class="story-badge">${idea.badge || 'Investigate'}</span>
            <h3 class="story-title">${idea.title}</h3>
            <p class="story-desc">${idea.description}</p>
            <div class="story-searches">
                ${idea.searches.map(s => `<span class="search-tag" onclick="doSearch('${esc(s)}')">${s}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderInvestigations() {
    const grid = document.getElementById('investigations-grid');
    if (!DATA.investigations?.cases?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    document.getElementById('stat-investigations').textContent = DATA.investigations.cases.length;
    grid.innerHTML = DATA.investigations.cases.map(c => `
        <div class="investigation-card" onclick="doSearch('${esc(c.name)}')">
            ${c.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <h3>${c.name}</h3>
            <div class="inv-amount">${c.amount}</div>
            <div class="inv-status">${c.status}</div>
            <p class="inv-update">${c.latestUpdate}</p>
        </div>
    `).join('');
}

function renderFigures() {
    const grid = document.getElementById('figures-grid');
    if (!DATA.figures?.people?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.figures.people.map(p => `
        <div class="figure-card">
            ${p.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <div class="figure-header">
                <div><h3>${p.name}</h3><span class="figure-role">${p.role}</span></div>
                <span class="figure-status status-${p.status}">${formatStatus(p.status)}</span>
            </div>
            <ul class="figure-allegations">${(p.allegations || []).map(a => `<li>${a}</li>`).join('')}</ul>
            <p class="figure-update">${p.latestUpdate}</p>
            <button class="btn-search-figure" onclick="doSearch('${esc(p.name)}')">Search "${p.name}"</button>
        </div>
    `).join('');
}

function renderQuickSearches() {
    const searches = [];
    DATA.trending?.topics?.slice(0, 3).forEach(t => { if (t.suggestedSearches?.[0]) searches.push(t.suggestedSearches[0]); });
    DATA.figures?.people?.slice(0, 2).forEach(p => searches.push(p.name));
    document.getElementById('quick-searches').innerHTML = `<span class="quick-label">Quick:</span>` +
        searches.slice(0, 5).map(s => `<span class="quick-tag" onclick="doSearch('${esc(s)}')">${s}</span>`).join('');
}

function updateLastUpdated() {
    const times = [DATA.news?.lastUpdated, DATA.trending?.lastUpdated].filter(Boolean);
    if (times.length) {
        const latest = new Date(Math.max(...times.map(t => new Date(t))));
        document.getElementById('last-updated-time').textContent = latest.toLocaleString();
    }
}

function formatStatus(s) { return { investigating: 'Under Investigation', convicted: 'Convicted', charged: 'Charged' }[s] || s; }

// ============================================
// SEARCH
// ============================================
function setupEventListeners() {
    document.getElementById('search-btn').addEventListener('click', () => doSearch(document.getElementById('search-input').value));
    document.getElementById('search-input').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(e.target.value); });
    document.getElementById('research-btn').addEventListener('click', showResearchPanel);
    document.getElementById('export-btn').addEventListener('click', exportCSV);
    document.getElementById('close-results-btn').addEventListener('click', () => document.getElementById('results-section').style.display = 'none');
}

function checkUrlParams() {
    const q = new URLSearchParams(location.search).get('q');
    if (q) { document.getElementById('search-input').value = q; doSearch(q); }
}

function doSearch(query) {
    if (!query?.trim()) return;
    document.getElementById('search-input').value = query;
    performSearch(query.trim());
    document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
}

async function performSearch(query) {
    currentQuery = query;
    const section = document.getElementById('results-section');
    const loading = document.getElementById('loading-state');
    const content = document.getElementById('results-content');
    
    section.style.display = 'block';
    loading.style.display = 'block';
    content.innerHTML = '';
    document.getElementById('results-query').textContent = query;
    document.getElementById('research-panel').style.display = 'none';
    
    section.scrollIntoView({ behavior: 'smooth' });
    
    currentResults = { grants: [], contracts: [], nonprofits: [], campaigns: [], local: [] };
    searchLocalData(query);
    
    await Promise.allSettled([
        searchUSASpending(query, 'grants', ['02','03','04','05']),
        searchUSASpending(query, 'contracts', ['A','B','C','D']),
        searchProPublica(query),
        searchFEC(query)
    ]);
    
    loading.style.display = 'none';
    renderResults();
}

function searchLocalData(query) {
    const q = query.toLowerCase();
    DATA.investigations?.cases?.forEach(c => {
        if (c.name.toLowerCase().includes(q)) {
            currentResults.local.push({ name: c.name, amount: c.amount, description: c.latestUpdate, source: 'Investigation', flagged: true });
        }
    });
    DATA.figures?.people?.forEach(p => {
        if (p.name.toLowerCase().includes(q)) {
            currentResults.local.push({ name: p.name, description: `${p.role} - ${p.latestUpdate}`, source: 'Key Figure', status: formatStatus(p.status), flagged: p.status !== 'cleared' });
        }
    });
}

async function searchUSASpending(query, type, codes) {
    try {
        const res = await fetch(`${CONFIG.USA_SPENDING}/search/spending_by_award/`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters: { keywords: [query], recipient_locations: [{ country: 'USA', state: 'MN' }], award_type_codes: codes }, fields: ['Recipient Name', 'Award Amount', 'Description'], page: 1, limit: 10, sort: 'Award Amount', order: 'desc' })
        });
        if (res.ok) {
            const data = await res.json();
            currentResults[type] = (data.results || []).map(r => ({ name: r['Recipient Name'] || 'Unknown', amount: r['Award Amount'] || 0, description: r['Description'] || `Federal ${type}`, source: 'USASpending' }));
        }
    } catch (e) {}
}

async function searchProPublica(query) {
    try {
        const res = await fetch(`${CONFIG.CORS_PROXY}${encodeURIComponent(`${CONFIG.PROPUBLICA}/search.json?q=${encodeURIComponent(query)}&state[id]=MN`)}`);
        if (res.ok) {
            const data = await res.json();
            currentResults.nonprofits = (data.organizations || []).slice(0, 10).map(o => ({ name: o.name, amount: o.income_amount || 0, description: `EIN: ${o.ein}`, source: 'ProPublica', url: `https://projects.propublica.org/nonprofits/organizations/${o.ein}` }));
        }
    } catch (e) {}
}

async function searchFEC(query) {
    try {
        const res = await fetch(`${CONFIG.FEC}/committees/?api_key=${CONFIG.FEC_KEY}&q=${encodeURIComponent(query)}&state=MN&per_page=10`);
        if (res.ok) {
            const data = await res.json();
            currentResults.campaigns = (data.results || []).map(c => ({ name: c.name, amount: c.receipts || 0, description: c.designation_full || '', source: 'FEC', url: `https://www.fec.gov/data/committee/${c.committee_id}/` }));
        }
    } catch (e) {}
}

function renderResults() {
    const content = document.getElementById('results-content');
    const totals = Object.fromEntries(Object.entries(currentResults).map(([k, v]) => [k, v.length]));
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    
    document.getElementById('results-summary').innerHTML = `
        <div class="summary-card"><span class="count">${total}</span><span class="label">Total</span></div>
        <div class="summary-card"><span class="count">${totals.local}</span><span class="label">Flagged</span></div>
        <div class="summary-card"><span class="count">${totals.grants}</span><span class="label">Grants</span></div>
        <div class="summary-card"><span class="count">${totals.nonprofits}</span><span class="label">Nonprofits</span></div>
    `;
    
    if (total === 0) { content.innerHTML = '<p class="no-results">No database results. Click "Deep Research" for web search.</p>'; return; }
    
    let html = '';
    if (totals.local) html += renderResultGroup('🚨 Flagged / Under Investigation', currentResults.local, true);
    if (totals.grants) html += renderResultGroup('Federal Grants', currentResults.grants);
    if (totals.contracts) html += renderResultGroup('Federal Contracts', currentResults.contracts);
    if (totals.nonprofits) html += renderResultGroup('Nonprofits', currentResults.nonprofits);
    if (totals.campaigns) html += renderResultGroup('Campaign Finance', currentResults.campaigns);
    content.innerHTML = html;
}

function renderResultGroup(title, items, flagged = false) {
    return `<div class="result-group ${flagged ? 'flagged-group' : ''}">
        <div class="group-header"><span>${title}</span><span class="group-count">${items.length}</span></div>
        <div class="group-items">${items.map(i => `
            <div class="result-item ${i.flagged ? 'flagged' : ''}">
                <div class="item-header"><span class="item-name">${esc(i.name)}</span>${i.amount ? `<span class="item-amount">${typeof i.amount === 'number' ? fmt(i.amount) : i.amount}</span>` : ''}</div>
                ${i.status ? `<span class="item-status">${i.status}</span>` : ''}
                <p class="item-desc">${esc(i.description)}</p>
                <div class="item-meta"><span>${i.source}</span>${i.url ? `<a href="${i.url}" target="_blank">View →</a>` : ''}</div>
            </div>
        `).join('')}</div>
    </div>`;
}

// ============================================
// DEEP RESEARCH PANEL - NO API KEY NEEDED!
// ============================================
function showResearchPanel() {
    const panel = document.getElementById('research-panel');
    panel.style.display = 'block';
    
    const q = encodeURIComponent(currentQuery + ' Minnesota fraud');
    const qSimple = encodeURIComponent(currentQuery);
    
    // Build research summary for AI prompt
    const summary = buildResearchSummary();
    const aiPrompt = encodeURIComponent(`I'm researching "${currentQuery}" in connection with Minnesota's $9 billion fraud scandal. Here's what I found in government databases:\n\n${summary}\n\nPlease help me:\n1. Understand any connections or red flags\n2. Suggest what else I should investigate\n3. Explain the significance of these findings`);
    
    // Research links
    document.getElementById('research-links').innerHTML = RESEARCH_SOURCES.map(s => 
        `<a href="${s.url}${q}" target="_blank" class="research-link">${s.icon} ${s.name}</a>`
    ).join('');
    
    // AI chat links with pre-filled prompt
    document.getElementById('ai-links').innerHTML = Object.entries(AI_CHATS).map(([key, ai]) => 
        `<a href="${ai.url}" target="_blank" class="ai-link" onclick="copyPromptToClipboard()" title="Opens ${ai.name} - paste your research summary">
            ${ai.icon} ${ai.name}
        </a>`
    ).join('');
    
    // Copyable prompt
    document.getElementById('ai-prompt').value = decodeURIComponent(aiPrompt);
}

function buildResearchSummary() {
    const lines = [];
    
    if (currentResults.local.length) {
        lines.push('FLAGGED RECORDS:');
        currentResults.local.forEach(r => lines.push(`- ${r.name}: ${r.description}`));
    }
    
    if (currentResults.grants.length) {
        lines.push('\nFEDERAL GRANTS:');
        currentResults.grants.slice(0, 5).forEach(r => lines.push(`- ${r.name}: ${fmt(r.amount)}`));
    }
    
    if (currentResults.nonprofits.length) {
        lines.push('\nNONPROFITS:');
        currentResults.nonprofits.slice(0, 5).forEach(r => lines.push(`- ${r.name} (${r.description})`));
    }
    
    if (currentResults.campaigns.length) {
        lines.push('\nCAMPAIGN FINANCE:');
        currentResults.campaigns.slice(0, 5).forEach(r => lines.push(`- ${r.name}: ${fmt(r.amount)}`));
    }
    
    return lines.join('\n') || 'No specific database matches found.';
}

function copyPromptToClipboard() {
    const prompt = document.getElementById('ai-prompt');
    prompt.select();
    document.execCommand('copy');
    
    // Show feedback
    const btn = document.getElementById('copy-prompt-btn');
    const original = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.style.background = '#22c55e';
    setTimeout(() => { btn.textContent = original; btn.style.background = ''; }, 2000);
}

function copyPrompt() {
    copyPromptToClipboard();
}

// ============================================
// UTILITIES
// ============================================
function fmt(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n); }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function exportCSV() {
    const all = Object.values(currentResults).flat();
    if (!all.length) { alert('No results to export'); return; }
    const csv = ['Name,Source,Amount,Description,Status', ...all.map(r => 
        `"${r.name}","${r.source}","${r.amount||''}","${r.description}","${r.status||''}"`
    )].join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `north-star-${currentQuery.replace(/\s+/g, '-')}.csv`;
    link.click();
}
