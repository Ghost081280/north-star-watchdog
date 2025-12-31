/* ============================================
   NORTH STAR WATCHDOG - RENDER MODULE
   All rendering functions with apostrophe bug fix
   
   CRITICAL: All onclick handlers use data-search attributes
   to properly escape apostrophes and special characters
   ============================================ */

// ============================================
// STATS RENDERING (CLICKABLE)
// ============================================

function renderStats() {
    if (!DATA.stats) return;
    const s = DATA.stats;
    
    // Charged stat - clickable
    const chargedEl = document.getElementById('stat-charged');
    if (chargedEl) {
        chargedEl.textContent = (s.charged?.count || 93) + '+';
        chargedEl.parentElement.style.cursor = 'pointer';
        chargedEl.parentElement.onclick = () => showStatSource(
            'Charged', 
            s.charged?.count || 93, 
            s.charged?.source || 'DOJ Minnesota & Court Records', 
            s.charged?.sourceUrl || 'https://www.justice.gov/usao-mn'
        );
    }
    
    // Convicted stat - clickable
    const convictedEl = document.getElementById('stat-convicted');
    if (convictedEl) {
        convictedEl.textContent = (s.convicted?.count || 57) + '+';
        convictedEl.parentElement.style.cursor = 'pointer';
        convictedEl.parentElement.onclick = () => showStatSource(
            'Convicted', 
            s.convicted?.count || 57, 
            s.convicted?.source || 'DOJ Feeding Our Future Case', 
            s.convicted?.sourceUrl || 'https://www.justice.gov/usao-mn/pr/feeding-our-future'
        );
    }
    
    // Alleged amount stat - clickable
    const allegedEl = document.getElementById('stat-alleged');
    if (allegedEl) {
        allegedEl.textContent = s.alleged?.amount || '$9B+';
        allegedEl.parentElement.style.cursor = 'pointer';
        allegedEl.parentElement.onclick = () => showStatSource(
            'Alleged Fraud', 
            s.alleged?.amount || '$9B+', 
            s.alleged?.source || 'House Oversight Committee', 
            s.alleged?.sourceUrl || 'https://oversight.house.gov/'
        );
    }
    
    // Cases count stat - clickable
    const casesEl = document.getElementById('stat-investigations');
    if (casesEl) {
        casesEl.textContent = s.cases?.count || 4;
        casesEl.parentElement.style.cursor = 'pointer';
        casesEl.parentElement.onclick = () => showStatSource(
            'Active Cases', 
            s.cases?.count || 4, 
            s.cases?.source || 'FBI / DOJ Minnesota', 
            s.cases?.sourceUrl || 'https://www.fbi.gov/contact-us/field-offices/minneapolis'
        );
    }
}

// ============================================
// BRIEFING RENDERING
// ============================================

function renderBriefing() {
    const content = document.getElementById('briefing-content');
    const time = document.getElementById('briefing-time');
    
    if (!content) return;
    
    if (!DATA.stats?.briefing) {
        content.textContent = 'AI briefing loading...';
        return;
    }
    
    content.textContent = DATA.stats.briefing;
    
    if (DATA.stats.lastUpdated && time) {
        const date = new Date(DATA.stats.lastUpdated);
        time.textContent = 'Updated: ' + date.toLocaleString();
    }
}

// ============================================
// BREAKING NEWS RENDERING
// ============================================

function renderBreaking() {
    if (!DATA.news?.breaking) return;
    const b = DATA.news.breaking;
    
    const textEl = document.getElementById('breaking-text');
    if (textEl) textEl.textContent = b.title;
    
    const sourceLink = document.getElementById('breaking-source');
    if (sourceLink) {
        sourceLink.href = b.link && b.link !== '#' 
            ? b.link 
            : 'https://news.google.com/search?q=Minnesota+fraud';
    }
}

// ============================================
// NEWS GRID RENDERING
// ============================================

function renderNews() {
    const grid = document.getElementById('news-grid');
    if (!grid) return;
    
    if (!DATA.news?.articles?.length) { 
        grid.innerHTML = '<p class="empty">Loading...</p>'; 
        return; 
    }
    
    grid.innerHTML = DATA.news.articles.slice(0, 8).map(a => `
        <div class="news-card">
            <div class="news-source">${esc(a.source)}</div>
            <h3 class="news-title">
                <a href="${a.link || '#'}" target="_blank" rel="noopener">${esc(a.title)}</a>
            </h3>
            <div class="news-date">${esc(a.date)}</div>
        </div>
    `).join('');
}

// ============================================
// TRENDING RENDERING (APOSTROPHE BUG FIX)
// ============================================

function renderTrending() {
    const grid = document.getElementById('trending-grid');
    if (!grid) return;
    
    if (!DATA.trending?.topics?.length) { 
        grid.innerHTML = '<p class="empty">Loading...</p>'; 
        return; 
    }
    
    // Sort NEW items first
    const sorted = [...DATA.trending.topics].sort((a, b) => 
        (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
    );
    
    grid.innerHTML = sorted.map(t => `
        <div class="trending-card${t.isNew ? ' trending-hot' : ''}">
            ${t.isNew ? '<span class="new-badge">HOT</span>' : ''}
            <h3 class="trending-topic">${esc(t.topic)}</h3>
            <p class="trending-reason">${esc(t.reason)}</p>
            <div class="trending-searches">
                ${(t.suggestedSearches || []).map(s => 
                    `<span class="search-tag" data-search="${escAttr(s)}" onclick="doSearch(this.dataset.search)">${esc(s)}</span>`
                ).join('')}
            </div>
        </div>
    `).join('');
}

// ============================================
// STORY IDEAS RENDERING (APOSTROPHE BUG FIX)
// ============================================

function renderStoryIdeas() {
    const grid = document.getElementById('stories-grid');
    if (!grid) return;
    
    if (!DATA.storyIdeas?.ideas?.length) { 
        grid.innerHTML = '<p class="empty">Loading...</p>'; 
        return; 
    }
    
    // Sort NEW items first
    const sorted = [...DATA.storyIdeas.ideas].sort((a, b) => 
        (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
    );
    
    grid.innerHTML = sorted.map(idea => `
        <div class="story-card${idea.isNew ? ' story-hot' : ''}">
            ${idea.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <span class="story-badge">${esc(idea.badge) || 'Investigate'}</span>
            <h3 class="story-title">${esc(idea.title)}</h3>
            <p class="story-desc">${esc(idea.description)}</p>
            <div class="story-searches">
                ${(idea.searches || []).map(s => 
                    `<span class="search-tag" data-search="${escAttr(s)}" onclick="doSearch(this.dataset.search)">${esc(s)}</span>`
                ).join('')}
            </div>
        </div>
    `).join('');
}

// ============================================
// INVESTIGATIONS RENDERING (APOSTROPHE BUG FIX)
// ============================================

function renderInvestigations() {
    const grid = document.getElementById('investigations-grid');
    if (!grid) return;
    
    if (!DATA.investigations?.cases?.length) { 
        grid.innerHTML = '<p class="empty">Loading...</p>'; 
        return; 
    }
    
    // Update stat count
    const statEl = document.getElementById('stat-investigations');
    if (statEl) statEl.textContent = DATA.investigations.cases.length;
    
    // Sort NEW items first
    const sorted = [...DATA.investigations.cases].sort((a, b) => 
        (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
    );
    
    grid.innerHTML = sorted.map(c => `
        <div class="investigation-card" data-search="${escAttr(c.name)}" onclick="doSearch(this.dataset.search)">
            ${c.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <h3>${esc(c.name)}</h3>
            <div class="inv-amount">${esc(c.amount)}</div>
            <div class="inv-status">${esc(c.status)}</div>
            <p class="inv-update">${esc(c.latestUpdate)}</p>
            ${c.sourceUrl ? `<a href="${c.sourceUrl}" target="_blank" rel="noopener" class="inv-source" onclick="event.stopPropagation()">View Source</a>` : ''}
        </div>
    `).join('');
}

// ============================================
// KEY FIGURES RENDERING (APOSTROPHE BUG FIX)
// ============================================

function renderFigures() {
    const grid = document.getElementById('figures-grid');
    if (!grid) return;
    
    if (!DATA.figures?.people?.length) { 
        grid.innerHTML = '<p class="empty">Loading...</p>'; 
        return; 
    }
    
    // Sort NEW items first
    const sorted = [...DATA.figures.people].sort((a, b) => 
        (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
    );
    
    grid.innerHTML = sorted.map(p => `
        <div class="figure-card${p.isNew ? ' figure-card-new' : ''}">
            ${p.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <div class="figure-header">
                <div>
                    <h3>${esc(p.name)}</h3>
                    <span class="figure-role">${esc(p.role)}</span>
                </div>
                ${p.sourceUrl 
                    ? `<a href="${p.sourceUrl}" target="_blank" rel="noopener" class="figure-status status-${p.status}">${formatStatus(p.status)}</a>`
                    : `<span class="figure-status status-${p.status}">${formatStatus(p.status)}</span>`
                }
            </div>
            <ul class="figure-allegations">
                ${(p.allegations || []).map(a => `<li>${esc(a)}</li>`).join('')}
            </ul>
            <p class="figure-update">${esc(p.latestUpdate)}</p>
            <button class="btn-search-figure" data-search="${escAttr(p.name)}" onclick="doSearch(this.dataset.search)">
                Search "${esc(p.name)}"
            </button>
        </div>
    `).join('');
}

// ============================================
// QUICK SEARCHES RENDERING (APOSTROPHE BUG FIX)
// ============================================

function renderQuickSearches() {
    const container = document.getElementById('quick-searches');
    if (!container) return;
    
    const searches = [];
    
    // First: Get trending topic names (AI-curated, updates hourly)
    DATA.trending?.topics?.forEach(t => {
        if (t.topic && !searches.includes(t.topic)) {
            searches.push(t.topic);
        }
    });
    
    // Fallback: If no trending, use suggested searches from trending
    if (searches.length < 3) {
        DATA.trending?.topics?.forEach(t => {
            t.suggestedSearches?.forEach(s => {
                if (!searches.includes(s)) searches.push(s);
            });
        });
    }
    
    // Fallback: Add key figures if still need more
    if (searches.length < 5) {
        DATA.figures?.people?.slice(0, 3).forEach(p => {
            if (!searches.includes(p.name)) searches.push(p.name);
        });
    }
    
    container.innerHTML = `<span class="quick-label">Trending:</span>` +
        searches.slice(0, 5).map(s => 
            `<span class="quick-tag" data-search="${escAttr(s)}" onclick="doSearch(this.dataset.search)">${esc(s)}</span>`
        ).join('');
}

// ============================================
// SEARCH RESULTS RENDERING
// ============================================

function renderResults() {
    const content = document.getElementById('results-content');
    
    // Calculate totals for each category
    const totals = Object.fromEntries(
        Object.entries(currentResults).map(([k, v]) => [k, v.length])
    );
    
    // Sources = database links (state + exclusions are just links)
    const sourceCount = totals.state + totals.exclusions;
    
    // Actual results from APIs
    const flaggedCount = totals.local || 0;
    const grantsCount = totals.grants || 0;
    const contractsCount = totals.contracts || 0;
    const nonprofitsCount = totals.nonprofits || 0;
    const campaignsCount = totals.campaigns || 0;
    const actualResults = flaggedCount + grantsCount + contractsCount + nonprofitsCount + campaignsCount;
    
    // Render summary bar - Show sources and actual results
    document.getElementById('results-summary').innerHTML = `
        <div class="summary-card">
            <span class="count">${sourceCount}</span>
            <span class="label">Databases</span>
        </div>
        <div class="summary-card ${flaggedCount > 0 ? 'has-results' : ''}">
            <span class="count">${flaggedCount}</span>
            <span class="label">Flagged</span>
        </div>
        <div class="summary-card ${grantsCount + contractsCount > 0 ? 'has-results' : ''}">
            <span class="count">${grantsCount + contractsCount}</span>
            <span class="label">Federal</span>
        </div>
        <div class="summary-card ${nonprofitsCount > 0 ? 'has-results' : ''}">
            <span class="count">${nonprofitsCount}</span>
            <span class="label">Nonprofits</span>
        </div>
        <div class="summary-card ${campaignsCount > 0 ? 'has-results' : ''}">
            <span class="count">${campaignsCount}</span>
            <span class="label">Campaigns</span>
        </div>
    `;
    
    // Show total actual results found
    const total = sourceCount + actualResults;
    
    if (actualResults === 0 && sourceCount > 0) { 
        content.innerHTML = '<p class="no-results">No direct matches found in APIs. Search the databases below or click "Deep Research + AI" for more.</p>'; 
    } else if (total === 0) {
        content.innerHTML = '<p class="no-results">No database results found. Click "Deep Research + AI" to search news and web sources.</p>'; 
    } else {
        let html = '';
        
        // 1. Flagged / Under Investigation
        if (totals.local) {
            html += renderResultGroup('Flagged / Under Investigation', currentResults.local, true);
        }
        
        // 2. Minnesota State Databases
        if (totals.state) {
            html += renderResultGroup('Minnesota State Databases', currentResults.state, false, true);
        }
        
        // 3. Federal Grants
        if (totals.grants) {
            html += renderResultGroup('Federal Grants', currentResults.grants);
        }
        
        // 4. Federal Contracts
        if (totals.contracts) {
            html += renderResultGroup('Federal Contracts', currentResults.contracts);
        }
        
        // 5. Federal Exclusions
        if (totals.exclusions) {
            html += renderResultGroup('Federal Exclusions & Watchlists', currentResults.exclusions, false, true);
        }
        
        // 6. Nonprofits
        if (totals.nonprofits) {
            html += renderResultGroup('Nonprofits', currentResults.nonprofits);
        }
        
        // 7. Campaign Finance
        if (totals.campaigns) {
            html += renderResultGroup('Campaign Finance', currentResults.campaigns);
        }
        
        content.innerHTML = html;
    }
    
    // Add Deep Research button after results
    content.innerHTML += `
        <div class="deep-research-trigger">
            <button id="deep-research-btn" class="btn-deep-research" onclick="doDeepResearch()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="M21 21l-4.35-4.35"/>
                    <path d="M11 8v6M8 11h6"/>
                </svg>
                Deep Research + AI Analysis
            </button>
            <p>Search news, videos, court records and get AI analysis</p>
        </div>
    `;
}

// ============================================
// RESULT GROUP RENDERING
// ============================================

function renderResultGroup(title, items, flagged = false, isLinkGroup = false) {
    return `
        <div class="result-group ${flagged ? 'flagged-group' : ''}">
            <div class="group-header">
                <span>${title}</span>
                <span class="group-count">${items.length}</span>
            </div>
            <div class="group-items">
                ${items.map(i => `
                    <div class="result-item ${i.flagged ? 'flagged' : ''}">
                        <div class="item-header">
                            <span class="item-name">${esc(i.name)}</span>
                            ${i.amount ? `<span class="item-amount">${typeof i.amount === 'number' ? fmt(i.amount) : esc(i.amount)}</span>` : ''}
                        </div>
                        ${i.status ? `<span class="item-status">${esc(i.status)}</span>` : ''}
                        <p class="item-desc">${esc(i.description)}</p>
                        <div class="item-meta">
                            <span>${esc(i.source)}</span>
                            ${i.url ? `<a href="${i.url}" target="_blank" rel="noopener">${isLinkGroup ? 'Search' : 'View'} &rarr;</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}
