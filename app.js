/* ============================================
   NORTH STAR WATCHDOG V5 - COMPLETE APP
   
   Flow:
   1. User searches → Database results
   2. User clicks "Deep Research + AI"
   3. We fetch news, show videos/courts/sources
   4. We call YOUR Cloudflare Worker for AI analysis
   5. Show real AI analysis
   6. Show continuation prompt for their own AI
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

let DATA = { news: null, trending: null, investigations: null, figures: null, storyIdeas: null };
let currentQuery = '';
let currentResults = {};
let webResearchResults = [];

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('%c⭐ North Star Watchdog V5', 'color:#d4af37;font-size:20px;font-weight:bold');
    
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
    setupBackToTop();
    checkUrlParams();
});

async function loadData(filename, key = null) {
    try {
        const res = await fetch(`data/${filename}.json?t=${Date.now()}`);
        if (res.ok) DATA[key || filename] = await res.json();
    } catch (e) { console.log(`Could not load ${filename}.json`); }
}

// ============================================
// BACK TO TOP BUTTON
// ============================================
function setupBackToTop() {
    const btn = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 500) {
            btn.classList.add('visible');
        } else {
            btn.classList.remove('visible');
        }
    });
}

// ============================================
// RENDER SECTIONS
// ============================================
function renderBreaking() {
    if (!DATA.news?.breaking) return;
    const b = DATA.news.breaking;
    document.getElementById('breaking-text').textContent = b.title;
    const sourceLink = document.getElementById('breaking-source');
    sourceLink.href = b.link && b.link !== '#' ? b.link : 'https://news.google.com/search?q=Minnesota+fraud';
}

function renderNews() {
    const grid = document.getElementById('news-grid');
    if (!DATA.news?.articles?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.news.articles.slice(0, 8).map(a => `
        <div class="news-card">
            <div class="news-source">${esc(a.source)}</div>
            <h3 class="news-title"><a href="${a.link || '#'}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
            <div class="news-date">${esc(a.date)}</div>
        </div>
    `).join('');
}

function renderTrending() {
    const grid = document.getElementById('trending-grid');
    if (!DATA.trending?.topics?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.trending.topics.map(t => `
        <div class="trending-card">
            <h3 class="trending-topic">${esc(t.topic)}</h3>
            <p class="trending-reason">${esc(t.reason)}</p>
            <div class="trending-searches">
                ${t.suggestedSearches.map(s => `<span class="search-tag" onclick="doSearch('${esc(s)}')">${esc(s)}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderStoryIdeas() {
    const grid = document.getElementById('stories-grid');
    if (!DATA.storyIdeas?.ideas?.length) { grid.innerHTML = '<p class="empty">Loading...</p>'; return; }
    grid.innerHTML = DATA.storyIdeas.ideas.map(idea => `
        <div class="story-card">
            <span class="story-badge">${esc(idea.badge) || 'Investigate'}</span>
            <h3 class="story-title">${esc(idea.title)}</h3>
            <p class="story-desc">${esc(idea.description)}</p>
            <div class="story-searches">
                ${idea.searches.map(s => `<span class="search-tag" onclick="doSearch('${esc(s)}')">${esc(s)}</span>`).join('')}
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
            <h3>${esc(c.name)}</h3>
            <div class="inv-amount">${esc(c.amount)}</div>
            <div class="inv-status">${esc(c.status)}</div>
            <p class="inv-update">${esc(c.latestUpdate)}</p>
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
                <div><h3>${esc(p.name)}</h3><span class="figure-role">${esc(p.role)}</span></div>
                <span class="figure-status status-${p.status}">${formatStatus(p.status)}</span>
            </div>
            <ul class="figure-allegations">${(p.allegations || []).map(a => `<li>${esc(a)}</li>`).join('')}</ul>
            <p class="figure-update">${esc(p.latestUpdate)}</p>
            <button class="btn-search-figure" onclick="doSearch('${esc(p.name)}')">Search "${esc(p.name)}"</button>
        </div>
    `).join('');
}

function renderQuickSearches() {
    const searches = [];
    DATA.trending?.topics?.slice(0, 3).forEach(t => { if (t.suggestedSearches?.[0]) searches.push(t.suggestedSearches[0]); });
    DATA.figures?.people?.slice(0, 2).forEach(p => searches.push(p.name));
    document.getElementById('quick-searches').innerHTML = `<span class="quick-label">Quick:</span>` +
        searches.slice(0, 5).map(s => `<span class="quick-tag" onclick="doSearch('${esc(s)}')">${esc(s)}</span>`).join('');
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
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    document.getElementById('search-btn').addEventListener('click', () => doSearch(document.getElementById('search-input').value));
    document.getElementById('search-input').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(e.target.value); });
    document.getElementById('export-btn').addEventListener('click', exportCSV);
    document.getElementById('close-results-btn').addEventListener('click', closeResults);
}

function checkUrlParams() {
    const q = new URLSearchParams(location.search).get('q');
    if (q) { document.getElementById('search-input').value = q; doSearch(q); }
}

function closeResults() {
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('deep-research').style.display = 'none';
}

// ============================================
// SEARCH
// ============================================
function doSearch(query) {
    if (!query?.trim()) return;
    document.getElementById('search-input').value = query;
    performSearch(query.trim());
}

async function performSearch(query) {
    currentQuery = query;
    const section = document.getElementById('results-section');
    const loading = document.getElementById('loading-state');
    const content = document.getElementById('results-content');
    const deepResearch = document.getElementById('deep-research');
    
    section.style.display = 'block';
    loading.style.display = 'block';
    content.innerHTML = '';
    deepResearch.style.display = 'none';
    document.getElementById('results-query').textContent = query;
    
    // Scroll to results
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    currentResults = { grants: [], contracts: [], nonprofits: [], campaigns: [], local: [] };
    webResearchResults = [];
    
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
        <div class="summary-card"><span class="count">${total}</span><span class="label">Total Results</span></div>
        <div class="summary-card"><span class="count">${totals.local}</span><span class="label">Flagged</span></div>
        <div class="summary-card"><span class="count">${totals.grants + totals.contracts}</span><span class="label">Federal</span></div>
        <div class="summary-card"><span class="count">${totals.nonprofits}</span><span class="label">Nonprofits</span></div>
    `;
    
    if (total === 0) { 
        content.innerHTML = '<p class="no-results">No database results found. Click "Deep Research + AI" to search news and web sources.</p>'; 
    } else {
        let html = '';
        if (totals.local) html += renderResultGroup('Flagged / Under Investigation', currentResults.local, true);
        if (totals.grants) html += renderResultGroup('Federal Grants', currentResults.grants);
        if (totals.contracts) html += renderResultGroup('Federal Contracts', currentResults.contracts);
        if (totals.nonprofits) html += renderResultGroup('Nonprofits', currentResults.nonprofits);
        if (totals.campaigns) html += renderResultGroup('Campaign Finance', currentResults.campaigns);
        content.innerHTML = html;
    }
    
    // Add Deep Research button after results
    content.innerHTML += `
        <div class="deep-research-trigger">
            <button id="deep-research-btn" class="btn-deep-research" onclick="doDeepResearch()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6M8 11h6"/></svg>
                Deep Research + AI Analysis
            </button>
            <p>Search news, videos, court records and get AI analysis</p>
        </div>
    `;
}

function renderResultGroup(title, items, flagged = false) {
    return `<div class="result-group ${flagged ? 'flagged-group' : ''}">
        <div class="group-header"><span>${title}</span><span class="group-count">${items.length}</span></div>
        <div class="group-items">${items.map(i => `
            <div class="result-item ${i.flagged ? 'flagged' : ''}">
                <div class="item-header"><span class="item-name">${esc(i.name)}</span>${i.amount ? `<span class="item-amount">${typeof i.amount === 'number' ? fmt(i.amount) : esc(i.amount)}</span>` : ''}</div>
                ${i.status ? `<span class="item-status">${esc(i.status)}</span>` : ''}
                <p class="item-desc">${esc(i.description)}</p>
                <div class="item-meta"><span>${esc(i.source)}</span>${i.url ? `<a href="${i.url}" target="_blank" rel="noopener">View →</a>` : ''}</div>
            </div>
        `).join('')}</div>
    </div>`;
}

// ============================================
// DEEP RESEARCH + AI ANALYSIS
// ============================================
async function doDeepResearch() {
    const deepResearch = document.getElementById('deep-research');
    deepResearch.style.display = 'block';
    
    // Scroll to deep research
    setTimeout(() => {
        deepResearch.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
    
    const q = encodeURIComponent(currentQuery + ' Minnesota fraud');
    
    // Render video links
    document.getElementById('video-links').innerHTML = `
        <a href="https://www.youtube.com/results?search_query=${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.6 3.5 12 3.5 12 3.5s-7.6 0-9.5.5c-1 .3-1.8 1.1-2 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1 1 1.8 2 2.1 1.9.5 9.5.5 9.5.5s7.6 0 9.5-.5c1-.3 1.8-1.1 2-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.5 15.5v-7l6.4 3.5-6.4 3.5z"/></svg>
            YouTube
        </a>
        <a href="https://www.tiktok.com/search?q=${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
            TikTok
        </a>
        <a href="https://twitter.com/search?q=${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            X/Twitter
        </a>
    `;
    
    // Render court/gov links
    document.getElementById('court-links').innerHTML = `
        <a href="https://www.google.com/search?q=site:justice.gov/usao-mn+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M12 3l9 7H3l9-7z"/></svg>
            DOJ Minnesota
        </a>
        <a href="https://www.courtlistener.com/?q=${encodeURIComponent(currentQuery)}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Court Listener
        </a>
        <a href="https://www.google.com/search?q=site:oversight.house.gov+minnesota+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M9 21V8l-6 4v9m12 0V8l6 4v9M12 3l9 7H3l9-7z"/></svg>
            House Oversight
        </a>
        <a href="https://www.google.com/search?q=site:startribune.com+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1"/></svg>
            Star Tribune
        </a>
        <a href="https://www.google.com/search?q=site:fox9.com+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>
            FOX 9
        </a>
        <a href="https://www.google.com/search?q=site:mprnews.org+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v3"/></svg>
            MPR News
        </a>
    `;
    
    // Fetch news
    const newsResults = document.getElementById('news-results');
    newsResults.innerHTML = '<div class="research-loading"><div class="spinner"></div><p>Searching news...</p></div>';
    
    webResearchResults = await fetchGoogleNews(currentQuery);
    
    if (webResearchResults.length > 0) {
        newsResults.innerHTML = webResearchResults.slice(0, 6).map(a => `
            <a href="${a.link}" target="_blank" rel="noopener" class="news-result-card">
                <div class="news-result-source">${esc(a.source)}</div>
                <div class="news-result-title">${esc(a.title)}</div>
                <div class="news-result-date">${esc(a.date)}</div>
            </a>
        `).join('');
    } else {
        newsResults.innerHTML = '<p class="no-news">No recent news found. Try the search links above.</p>';
    }
    
    // Now call AI for analysis
    await runAIAnalysis();
}

async function fetchGoogleNews(searchTerm) {
    const terms = [
        `${searchTerm} Minnesota fraud`,
        `${searchTerm} Minnesota investigation`
    ];
    
    const allArticles = [];
    
    for (const term of terms) {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(term)}&hl=en-US&gl=US&ceid=US:en`;
        
        try {
            const res = await fetch(`${CONFIG.CORS_PROXY}${encodeURIComponent(url)}`);
            if (!res.ok) continue;
            
            const text = await res.text();
            const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
            
            for (const item of itemMatches.slice(0, 5)) {
                const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
                const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
                const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
                
                let cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                const dashIdx = cleanTitle.lastIndexOf(' - ');
                const source = dashIdx > -1 ? cleanTitle.substring(dashIdx + 3) : 'News';
                cleanTitle = dashIdx > -1 ? cleanTitle.substring(0, dashIdx) : cleanTitle;
                
                if (cleanTitle && link) {
                    allArticles.push({
                        title: cleanTitle,
                        source: source,
                        link: link,
                        date: pubDate ? new Date(pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'
                    });
                }
            }
        } catch (e) {
            console.log('News fetch error:', e);
        }
    }
    
    // Deduplicate
    const seen = new Set();
    return allArticles.filter(a => {
        const key = a.title.toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ============================================
// AI ANALYSIS (calls your Cloudflare Worker)
// ============================================
async function runAIAnalysis() {
    const aiSection = document.querySelector('.ai-section');
    
    // Show loading in AI section
    const analysisDiv = document.createElement('div');
    analysisDiv.id = 'ai-analysis-result';
    analysisDiv.className = 'ai-analysis-result';
    analysisDiv.innerHTML = '<div class="research-loading"><div class="spinner"></div><p>AI is analyzing your research...</p></div>';
    
    // Insert before the prompt box
    const promptBox = document.querySelector('.ai-prompt-box');
    promptBox.parentNode.insertBefore(analysisDiv, promptBox);
    
    // Build the prompt for AI
    const prompt = buildAnalysisPrompt();
    
    try {
        const res = await fetch(CONFIG.AI_WORKER, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });
        
        if (!res.ok) throw new Error('AI service unavailable');
        
        const data = await res.json();
        
        if (data.analysis) {
            analysisDiv.innerHTML = `
                <h5>AI Analysis</h5>
                <div class="analysis-content">${formatAIResponse(data.analysis)}</div>
            `;
        } else {
            throw new Error('No analysis returned');
        }
    } catch (error) {
        console.error('AI analysis error:', error);
        analysisDiv.innerHTML = `
            <div class="ai-error">
                <p>AI analysis unavailable. Use the research links above and copy the prompt below to analyze in your preferred AI.</p>
            </div>
        `;
    }
    
    // Build continuation prompt
    buildContinuationPrompt();
    
    // Render AI chat links
    document.getElementById('ai-links').innerHTML = AI_CHATS.map(ai => `
        <a href="${ai.url}" target="_blank" rel="noopener" class="ai-link">${ai.name}</a>
    `).join('');
}

function buildAnalysisPrompt() {
    let prompt = `Analyze this research on "${currentQuery}" related to Minnesota's fraud scandal:\n\n`;
    
    // Database findings
    prompt += `=== DATABASE RESULTS ===\n`;
    
    if (currentResults.local.length) {
        prompt += `\nFLAGGED RECORDS:\n`;
        currentResults.local.forEach(r => prompt += `- ${r.name}: ${r.description}\n`);
    }
    
    if (currentResults.grants.length) {
        prompt += `\nFEDERAL GRANTS:\n`;
        currentResults.grants.slice(0, 5).forEach(r => prompt += `- ${r.name}: ${fmt(r.amount)}\n`);
    }
    
    if (currentResults.nonprofits.length) {
        prompt += `\nNONPROFITS:\n`;
        currentResults.nonprofits.slice(0, 5).forEach(r => prompt += `- ${r.name} (${r.description})\n`);
    }
    
    if (currentResults.campaigns.length) {
        prompt += `\nCAMPAIGN FINANCE:\n`;
        currentResults.campaigns.slice(0, 5).forEach(r => prompt += `- ${r.name}: ${fmt(r.amount)}\n`);
    }
    
    // News findings
    if (webResearchResults.length) {
        prompt += `\n=== RECENT NEWS ===\n`;
        webResearchResults.slice(0, 6).forEach(a => prompt += `- "${a.title}" (${a.source})\n`);
    }
    
    prompt += `\nProvide a concise analysis covering:
1. Key findings and what they suggest
2. Red flags or concerning patterns
3. Connections to the broader Minnesota fraud scandal
4. Recommended next steps for investigation`;
    
    return prompt;
}

function buildContinuationPrompt() {
    let prompt = `I'm researching "${currentQuery}" in connection with Minnesota's $9 billion fraud scandal. Here's what I found:\n\n`;
    
    // Add all findings
    prompt += `=== DATABASE FINDINGS ===\n`;
    
    if (currentResults.local.length) {
        prompt += `\nFLAGGED RECORDS:\n`;
        currentResults.local.forEach(r => prompt += `- ${r.name}: ${r.description}\n`);
    }
    
    if (currentResults.grants.length) {
        prompt += `\nFEDERAL GRANTS:\n`;
        currentResults.grants.slice(0, 5).forEach(r => prompt += `- ${r.name}: ${fmt(r.amount)}\n`);
    }
    
    if (currentResults.nonprofits.length) {
        prompt += `\nNONPROFITS:\n`;
        currentResults.nonprofits.slice(0, 5).forEach(r => prompt += `- ${r.name} (${r.description})\n`);
    }
    
    if (currentResults.campaigns.length) {
        prompt += `\nCAMPAIGN FINANCE:\n`;
        currentResults.campaigns.slice(0, 5).forEach(r => prompt += `- ${r.name}: ${fmt(r.amount)}\n`);
    }
    
    if (webResearchResults.length) {
        prompt += `\n=== RECENT NEWS ===\n`;
        webResearchResults.slice(0, 6).forEach(a => prompt += `- "${a.title}" (${a.source}, ${a.date})\n`);
    }
    
    prompt += `\n=== BACKGROUND ===
Minnesota is facing a $9B+ fraud scandal:
- Feeding Our Future: $250M stolen, 78 indicted, 57+ convicted
- CCAP Daycare: $1B+ estimated fraud
- EIDBI Autism Services: $220M+ fraud
- Housing Stabilization: $302M, program terminated

=== QUESTIONS ===
1. What additional connections do you see?
2. What should I investigate next?
3. Are there patterns I'm missing?`;

    document.getElementById('ai-prompt').value = prompt;
}

function formatAIResponse(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^### (.*$)/gm, '<h6>$1</h6>')
        .replace(/^## (.*$)/gm, '<h5>$1</h5>')
        .replace(/^# (.*$)/gm, '<h5>$1</h5>')
        .replace(/^\d+\.\s+\*\*(.*?)\*\*:?\s*/gm, '<p><strong>$1:</strong> ')
        .replace(/^\d+\.\s+(.*$)/gm, '<p>• $1</p>')
        .replace(/^- (.*$)/gm, '<p>• $1</p>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

function copyPrompt() {
    const prompt = document.getElementById('ai-prompt');
    prompt.select();
    prompt.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(prompt.value).then(() => {
        const btn = document.getElementById('copy-prompt-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
        btn.style.background = '#22c55e';
        setTimeout(() => { btn.innerHTML = originalHTML; btn.style.background = ''; }, 2000);
    }).catch(() => {
        document.execCommand('copy');
    });
}

// ============================================
// UTILITIES
// ============================================
function fmt(n) { 
    if (typeof n !== 'number') return n;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n); 
}

function esc(s) { 
    if (!s) return ''; 
    const d = document.createElement('div'); 
    d.textContent = s; 
    return d.innerHTML; 
}

function exportCSV() {
    const all = Object.values(currentResults).flat();
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
