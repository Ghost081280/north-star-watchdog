/* ============================================
   NORTH STAR WATCHDOG V5 - DEEP RESEARCH
   
   - Site auto-updates hourly via AI (GitHub Actions)
   - User searches get REAL web research
   - Shows actual news/articles found
   - Then gives prompt for their AI
   ============================================ */

const CONFIG = {
    CORS_PROXY: 'https://api.allorigins.win/raw?url=',
    USA_SPENDING: 'https://api.usaspending.gov/api/v2',
    PROPUBLICA: 'https://projects.propublica.org/nonprofits/api/v2',
    FEC: 'https://api.open.fec.gov/v1',
    FEC_KEY: 'bhv66hmghpNdcPqd82WMszdJhspXQDKhoqeteL1U'
};

// AI chat URLs
const AI_CHATS = {
    chatgpt: { name: 'ChatGPT', url: 'https://chat.openai.com/', icon: '🤖' },
    claude: { name: 'Claude', url: 'https://claude.ai/', icon: '🧠' },
    gemini: { name: 'Gemini', url: 'https://gemini.google.com/', icon: '✨' },
    grok: { name: 'Grok', url: 'https://grok.x.ai/', icon: '🚀' },
    perplexity: { name: 'Perplexity', url: 'https://perplexity.ai/', icon: '🔍' }
};

let DATA = { news: null, trending: null, investigations: null, figures: null, storyIdeas: null };
let currentQuery = '';
let currentResults = {};
let webResearchResults = [];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c⭐ North Star Watchdog V5', 'color:#d4af37;font-size:20px;font-weight:bold');
    console.log('%c🔍 Deep Research Edition', 'color:#22c55e');
    
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
// RENDER SECTIONS
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
    document.getElementById('research-btn').addEventListener('click', doDeepResearch);
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
    webResearchResults = [];
    
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
    
    if (total === 0) { content.innerHTML = '<p class="no-results">No database results. Click "Deep Research + AI" to search news & web.</p>'; return; }
    
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
// DEEP RESEARCH - ACTUALLY SEARCHES THE WEB!
// ============================================
async function doDeepResearch() {
    const panel = document.getElementById('research-panel');
    panel.style.display = 'block';
    
    const resultsDiv = document.getElementById('web-research-results');
    resultsDiv.innerHTML = '<div class="research-loading"><div class="spinner"></div><p>Searching news, DOJ, and court records...</p></div>';
    
    // Scroll to panel
    panel.scrollIntoView({ behavior: 'smooth' });
    
    webResearchResults = [];
    
    // Search multiple sources via Google News RSS
    const searchTerms = [
        `${currentQuery} Minnesota fraud`,
        `${currentQuery} Minnesota investigation`,
        `${currentQuery} indicted OR charged OR convicted`
    ];
    
    // Fetch from Google News RSS
    for (const term of searchTerms) {
        try {
            const articles = await fetchGoogleNews(term);
            webResearchResults.push(...articles);
        } catch (e) {
            console.log('Search error:', e);
        }
    }
    
    // Deduplicate by title
    const seen = new Set();
    webResearchResults = webResearchResults.filter(a => {
        const key = a.title.toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    // Sort by date (newest first)
    webResearchResults.sort((a, b) => new Date(b.rawDate || 0) - new Date(a.rawDate || 0));
    
    // Render results
    renderWebResearch();
}

async function fetchGoogleNews(searchTerm) {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerm)}&hl=en-US&gl=US&ceid=US:en`;
    
    try {
        const res = await fetch(`${CONFIG.CORS_PROXY}${encodeURIComponent(url)}`);
        if (!res.ok) return [];
        
        const text = await res.text();
        const articles = [];
        
        // Parse RSS XML
        const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
        
        for (const item of itemMatches.slice(0, 5)) {
            const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
            const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            
            // Clean title
            let cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            const dashIdx = cleanTitle.lastIndexOf(' - ');
            const source = dashIdx > -1 ? cleanTitle.substring(dashIdx + 3) : 'News';
            cleanTitle = dashIdx > -1 ? cleanTitle.substring(0, dashIdx) : cleanTitle;
            
            if (cleanTitle && link) {
                articles.push({
                    title: cleanTitle,
                    source: source,
                    link: link,
                    date: pubDate ? new Date(pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
                    rawDate: pubDate ? new Date(pubDate) : null
                });
            }
        }
        
        return articles;
    } catch (e) {
        console.log('Fetch error:', e);
        return [];
    }
}

function renderWebResearch() {
    const resultsDiv = document.getElementById('web-research-results');
    
    if (webResearchResults.length === 0) {
        resultsDiv.innerHTML = `
            <p class="no-web-results">No recent news found. Try the manual search links below:</p>
            <div class="manual-search-links">
                ${getManualSearchLinks()}
            </div>
        `;
    } else {
        resultsDiv.innerHTML = `
            <div class="web-results-header">
                <span>📰 Found ${webResearchResults.length} articles</span>
            </div>
            <div class="web-results-grid">
                ${webResearchResults.slice(0, 10).map(a => `
                    <a href="${a.link}" target="_blank" class="web-result-card">
                        <div class="web-result-source">${esc(a.source)}</div>
                        <div class="web-result-title">${esc(a.title)}</div>
                        <div class="web-result-date">${a.date}</div>
                    </a>
                `).join('')}
            </div>
            <div class="more-search-links">
                <p>Search more sources:</p>
                ${getManualSearchLinks()}
            </div>
        `;
    }
    
    // Build and show the AI prompt
    buildAIPrompt();
}

function getManualSearchLinks() {
    const q = encodeURIComponent(currentQuery + ' Minnesota fraud');
    return `
        <div class="manual-links">
            <a href="https://www.google.com/search?q=site:justice.gov/usao-mn+${q}" target="_blank" class="manual-link">⚖️ DOJ Minnesota</a>
            <a href="https://news.google.com/search?q=${q}" target="_blank" class="manual-link">📰 Google News</a>
            <a href="https://www.courtlistener.com/?q=${encodeURIComponent(currentQuery)}" target="_blank" class="manual-link">🏛️ Court Records</a>
            <a href="https://www.google.com/search?q=site:startribune.com+${q}" target="_blank" class="manual-link">📰 Star Tribune</a>
            <a href="https://www.google.com/search?q=site:fox9.com+${q}" target="_blank" class="manual-link">📺 FOX 9</a>
            <a href="https://www.google.com/search?q=site:mprnews.org+${q}" target="_blank" class="manual-link">📻 MPR News</a>
        </div>
    `;
}

function buildAIPrompt() {
    // Build comprehensive research summary
    let summary = `I'm researching "${currentQuery}" in connection with Minnesota's $9 billion fraud scandal.\n\n`;
    
    // Add database findings
    summary += `=== DATABASE FINDINGS ===\n`;
    
    if (currentResults.local.length) {
        summary += `\n🚨 FLAGGED RECORDS:\n`;
        currentResults.local.forEach(r => {
            summary += `• ${r.name}: ${r.description}\n`;
        });
    }
    
    if (currentResults.grants.length) {
        summary += `\n💰 FEDERAL GRANTS:\n`;
        currentResults.grants.slice(0, 5).forEach(r => {
            summary += `• ${r.name}: ${fmt(r.amount)}\n`;
        });
    }
    
    if (currentResults.nonprofits.length) {
        summary += `\n🏢 NONPROFITS:\n`;
        currentResults.nonprofits.slice(0, 5).forEach(r => {
            summary += `• ${r.name} (${r.description})\n`;
        });
    }
    
    if (currentResults.campaigns.length) {
        summary += `\n🗳️ CAMPAIGN FINANCE:\n`;
        currentResults.campaigns.slice(0, 5).forEach(r => {
            summary += `• ${r.name}: ${fmt(r.amount)}\n`;
        });
    }
    
    // Add news findings
    if (webResearchResults.length) {
        summary += `\n=== RECENT NEWS (${webResearchResults.length} articles found) ===\n`;
        webResearchResults.slice(0, 8).forEach(a => {
            summary += `• "${a.title}" (${a.source}, ${a.date})\n`;
        });
    }
    
    // Add context
    summary += `\n=== BACKGROUND ===\n`;
    summary += `Minnesota is facing a $9B+ fraud scandal across multiple programs:\n`;
    summary += `• Feeding Our Future: $250M stolen, 78 indicted, 57+ convicted\n`;
    summary += `• CCAP Daycare: $1B+ estimated fraud, 62 investigations\n`;
    summary += `• EIDBI Autism Services: $220M+ fraud\n`;
    summary += `• Housing Stabilization: $302M, program terminated\n`;
    
    // Add questions
    summary += `\n=== HELP ME UNDERSTAND ===\n`;
    summary += `1. What connections or red flags do you see in this data?\n`;
    summary += `2. What patterns should I investigate further?\n`;
    summary += `3. What questions should I be asking?\n`;
    summary += `4. What other public records should I search?`;
    
    document.getElementById('ai-prompt').value = summary;
    
    // Render AI links
    document.getElementById('ai-links').innerHTML = Object.entries(AI_CHATS).map(([key, ai]) => 
        `<a href="${ai.url}" target="_blank" class="ai-link" title="Open ${ai.name} and paste your research">
            ${ai.icon} ${ai.name}
        </a>`
    ).join('');
}

function copyPrompt() {
    const prompt = document.getElementById('ai-prompt');
    prompt.select();
    prompt.setSelectionRange(0, 99999); // Mobile support
    
    navigator.clipboard.writeText(prompt.value).then(() => {
        const btn = document.getElementById('copy-prompt-btn');
        const original = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#22c55e';
        setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; }, 2000);
    }).catch(() => {
        document.execCommand('copy');
    });
}

// ============================================
// UTILITIES
// ============================================
function fmt(n) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n); }
function esc(s) { if (!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function exportCSV() {
    const all = Object.values(currentResults).flat();
    
    // Add web research to export
    webResearchResults.forEach(a => {
        all.push({ name: a.title, source: a.source, amount: '', description: a.link, status: a.date });
    });
    
    if (!all.length) { alert('No results to export'); return; }
    
    const csv = ['Name,Source,Amount,Description,Date/Status', ...all.map(r => 
        `"${(r.name||'').replace(/"/g, '""')}","${r.source||''}","${r.amount||''}","${(r.description||'').replace(/"/g, '""')}","${r.status||r.date||''}"`
    )].join('\n');
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    link.download = `north-star-${currentQuery.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}
