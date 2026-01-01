/* ============================================
   NORTH STAR WATCHDOG - RENDER MODULE
   All rendering functions with apostrophe bug fix
   
   FIXES APPLIED:
   - News results now render in renderResults()
   - Improved detective card deduplication
   - All onclick handlers use data-search attributes
   - Uses AI-provided confidence scores (not hardcoded)
   ============================================ */

// ============================================
// STATS RENDERING (CLICKABLE)
// ============================================

function renderStats() {
    if (!DATA.stats) return;
    const s = DATA.stats;
    
    // Stats come directly from AI analysis - no hardcoded fallbacks
    // If no data, show 0 until first scan runs
    
    // Charged stat - clickable
    const chargedEl = document.getElementById('stat-charged');
    if (chargedEl) {
        const charged = s.charged || 0;
        chargedEl.textContent = charged + '+';
        chargedEl.parentElement.style.cursor = 'pointer';
        chargedEl.parentElement.onclick = () => showStatSource(
            'Charged', 
            charged, 
            'AI Analysis of News', 
            'https://www.justice.gov/usao-mn'
        );
    }
    
    // Convicted stat - clickable
    const convictedEl = document.getElementById('stat-convicted');
    if (convictedEl) {
        const convicted = s.convicted || 0;
        convictedEl.textContent = convicted + '+';
        convictedEl.parentElement.style.cursor = 'pointer';
        convictedEl.parentElement.onclick = () => showStatSource(
            'Convicted', 
            convicted, 
            'AI Analysis of News', 
            'https://www.justice.gov/usao-mn'
        );
    }
    
    // Alleged amount stat - clickable
    const allegedEl = document.getElementById('stat-alleged');
    if (allegedEl) {
        const alleged = s.alleged || '$0';
        allegedEl.textContent = alleged;
        allegedEl.parentElement.style.cursor = 'pointer';
        allegedEl.parentElement.onclick = () => showStatSource(
            'Alleged Fraud', 
            alleged, 
            'AI Analysis of News', 
            'https://oversight.house.gov/'
        );
    }
    
    // Cases count stat - clickable
    const casesEl = document.getElementById('stat-investigations');
    if (casesEl) {
        const cases = s.activeCases || DATA.investigations?.cases?.length || 0;
        casesEl.textContent = cases;
        casesEl.parentElement.style.cursor = 'pointer';
        casesEl.parentElement.onclick = () => showStatSource(
            'Active Cases', 
            cases, 
            'AI Analysis of News', 
            'https://www.fbi.gov/contact-us/field-offices/minneapolis'
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
        time.textContent = 'Updated: ' + date.toLocaleString('en-US', {
            timeZone: 'America/New_York',
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }) + ' EST';
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
    
    // FILTER: Only show investigations with valid source URLs
    // This ensures we can prove every investigation we display
    const validCases = DATA.investigations.cases.filter(c => {
        // Must have a sourceUrl that starts with http
        const sourceUrl = c.sourceUrl || '';
        return sourceUrl && sourceUrl.startsWith('http');
    });
    
    if (!validCases.length) {
        grid.innerHTML = '<p class="empty">No verified investigations currently tracked.</p>';
        return;
    }
    
    // Update stat count with only valid cases
    const statEl = document.getElementById('stat-investigations');
    if (statEl) statEl.textContent = validCases.length;
    
    // Sort NEW items first
    const sorted = [...validCases].sort((a, b) => 
        (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)
    );
    
    grid.innerHTML = sorted.map(c => `
        <div class="investigation-card" data-search="${escAttr(c.name)}" onclick="doSearch(this.dataset.search)">
            ${c.isNew ? '<span class="new-badge">NEW</span>' : ''}
            <h3>${esc(c.name)}</h3>
            <div class="inv-amount">${esc(c.amount)}</div>
            <div class="inv-status">${esc(c.status)}</div>
            <p class="inv-update">${esc(c.latestUpdate)}</p>
            <a href="${c.sourceUrl}" target="_blank" rel="noopener" class="inv-source" onclick="event.stopPropagation()">View Source</a>
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
    
    // FILTER: Must be actually CHARGED with specific crimes
    // This applies to EVERYONE - officials, business owners, anyone
    // If Tim Walz gets indicted for wire fraud, he WILL appear. Until then, he won't.
    
    // Valid statuses - must be actually charged/convicted (not just "investigating" or "active")
    const chargedStatuses = ['charged', 'convicted', 'sentenced', 'indicted'];
    
    // Specific criminal allegations (generic "fraud" alone doesn't count)
    const specificAllegations = ['wire fraud', 'money laundering', 'federal program fraud', 'false claims', 'conspiracy', 'tax fraud', 'embezzlement', 'mail fraud', 'bank fraud'];
    
    // Journalists are NEVER fraud suspects - they report on fraud
    const journalists = ['nick shirley'];
    
    // Generic/vague entries to filter out
    const genericNames = ['unknown', 'minnesota child care providers', 'various'];
    
    const fraudSuspects = DATA.figures.people.filter(p => {
        const nameLower = (p.name || '').toLowerCase();
        
        // Filter out journalists
        if (journalists.some(j => nameLower.includes(j))) return false;
        
        // Filter out generic entries
        if (genericNames.some(g => nameLower.includes(g))) return false;
        
        // Must have allegations
        if (!p.allegations || p.allegations.length === 0) return false;
        
        // Must have at least one SPECIFIC allegation
        const hasSpecific = p.allegations.some(a => 
            specificAllegations.some(s => a.toLowerCase().includes(s))
        );
        if (!hasSpecific) return false;
        
        // Must be actually charged (not just "investigating" or "active")
        const status = (p.status || '').toLowerCase();
        if (!chargedStatuses.includes(status)) return false;
        
        return true;
    });
    
    if (!fraudSuspects.length) {
        grid.innerHTML = '<p class="empty">No fraud suspects currently tracked.</p>';
        return;
    }
    
    // Sort NEW items first
    const sorted = [...fraudSuspects].sort((a, b) => 
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
                <span class="figure-status status-${p.status}">${formatStatus(p.status)}</span>
            </div>
            <ul class="figure-allegations">
                ${(p.allegations || []).map(a => `<li>${esc(a)}</li>`).join('')}
            </ul>
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
// FIX: Now includes news results
// ============================================

function renderResults() {
    const content = document.getElementById('results-content');
    
    // Calculate totals for each category
    const totals = Object.fromEntries(
        Object.entries(currentResults).map(([k, v]) => [k, v.length])
    );
    
    // Sources = database links (state + exclusions are just links)
    const sourceCount = totals.state + totals.exclusions;
    
    // Actual results from APIs and local data
    const flaggedCount = totals.local || 0;
    const newsCount = totals.news || 0;  // FIX: Count news results
    const grantsCount = totals.grants || 0;
    const contractsCount = totals.contracts || 0;
    const nonprofitsCount = totals.nonprofits || 0;
    const campaignsCount = totals.campaigns || 0;
    const actualResults = flaggedCount + newsCount + grantsCount + contractsCount + nonprofitsCount + campaignsCount;
    
    // Render summary bar - Show sources and actual results
    document.getElementById('results-summary').innerHTML = `
        <div class="summary-card">
            <span class="count">${sourceCount}</span>
            <span class="label">Databases</span>
        </div>
        <div class="summary-card ${flaggedCount > 0 ? 'has-flagged' : ''}">
            <span class="count">${flaggedCount}</span>
            <span class="label">Flagged</span>
        </div>
        <div class="summary-card ${newsCount > 0 ? 'has-results' : ''}">
            <span class="count">${newsCount}</span>
            <span class="label">News</span>
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
        
        // 2. FIX: News Results
        if (totals.news) {
            html += renderResultGroup('News Articles', currentResults.news, false, false, true);
        }
        
        // 3. Minnesota State Databases
        if (totals.state) {
            html += renderResultGroup('Minnesota State Databases', currentResults.state, false, true);
        }
        
        // 4. Federal Grants
        if (totals.grants) {
            html += renderResultGroup('Federal Grants', currentResults.grants);
        }
        
        // 5. Federal Contracts
        if (totals.contracts) {
            html += renderResultGroup('Federal Contracts', currentResults.contracts);
        }
        
        // 6. Federal Exclusions
        if (totals.exclusions) {
            html += renderResultGroup('Federal Exclusions & Watchlists', currentResults.exclusions, false, true);
        }
        
        // 7. Nonprofits
        if (totals.nonprofits) {
            html += renderResultGroup('Nonprofits', currentResults.nonprofits);
        }
        
        // 8. Campaign Finance
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
// FIX: Added isNews parameter for news-specific styling
// ============================================

function renderResultGroup(title, items, flagged = false, isLinkGroup = false, isNews = false) {
    return `
        <div class="result-group ${flagged ? 'flagged-group' : ''} ${isNews ? 'news-group' : ''}">
            <div class="group-header">
                <span>${title}</span>
                <span class="group-count">${items.length}</span>
            </div>
            <div class="group-items">
                ${items.map(i => `
                    <div class="result-item ${i.flagged ? 'flagged' : ''} ${i.isBreaking ? 'breaking-item' : ''}">
                        <div class="item-header">
                            <span class="item-name">${esc(i.name)}</span>
                            ${i.amount ? `<span class="item-amount">${typeof i.amount === 'number' ? fmt(i.amount) : esc(i.amount)}</span>` : ''}
                        </div>
                        ${i.status ? `<span class="item-status">${esc(i.status)}</span>` : ''}
                        <p class="item-desc">${esc(i.description)}</p>
                        <div class="item-meta">
                            <span>${esc(i.source)}</span>
                            ${i.date ? `<span class="item-date">${esc(i.date)}</span>` : ''}
                            ${i.url ? `<a href="${i.url}" target="_blank" rel="noopener">${isLinkGroup ? 'Search' : 'View'} &rarr;</a>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ============================================
// AI DETECTIVE RENDERING
// FIX: Uses AI-provided confidence scores
// ============================================

function renderDetective() {
    const grid = document.getElementById('detective-grid');
    const timeEl = document.getElementById('detective-time');
    
    if (!grid) return;
    
    // Load red flags from data
    const redFlags = DATA.redFlags?.flags || [];
    
    // Get the ACTUAL sources used from the data (set by backend)
    const globalSourcesUsed = DATA.redFlags?.sourcesUsed || [];
    const globalSourceCount = DATA.redFlags?.sourceCount || globalSourcesUsed.length;
    
    // Generate findings from various sources
    let findings = [];
    
    // Add red flags from data
    redFlags.forEach((flag, idx) => {
        // Use the apisUsed from the actual flag if available, otherwise use global sourcesUsed
        const flagSources = flag.apisUsed || flag.sourcesUsed || globalSourcesUsed;
        const flagSourceCount = flag.sourceCount || flagSources.length;
        
        findings.push({
            type: 'red-flag',
            typeLabel: 'Red Flag',
            title: flag.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Suspicious Pattern',
            description: flag.description,
            insight: flag.insight || null, // Detective's insight
            entities: flag.entities || [],
            confidence: flag.confidence || (flag.priority === 'high' ? 85 : flag.priority === 'medium' ? 65 : 45),
            apisUsed: flagSources,
            totalSources: flagSourceCount,
            _key: normalizeForDedup(flag.type, flag.description)
        });
    });
    
    // FIX: Better deduplication - normalize and compare
    const seen = new Set();
    findings = findings.filter(f => {
        const key = f._key;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    // Show message if no sources available
    const noSourcesWarning = globalSourcesUsed.length === 0 ? 
        '<p class="no-sources-warning">⚠️ No OSINT sources available for this scan. Some APIs may need configuration.</p>' : '';
    
    // Default findings if no red flags loaded
    if (findings.length === 0) {
        grid.innerHTML = noSourcesWarning + '<p class="no-results">AI Detective is analyzing patterns. Check back soon.</p>';
        return;
    }
    
    // LIMIT to 6 cards max
    findings = findings.slice(0, 6);
    
    // Render findings with detective insight boxes
    grid.innerHTML = noSourcesWarning + findings.map((f, idx) => {
        const cardClass = f.type;
        const gaugeColor = f.confidence >= 80 ? '#ef4444' : f.confidence >= 60 ? '#f59e0b' : '#22c55e';
        const gaugePercent = f.confidence / 100;
        const circumference = 2 * Math.PI * 40;
        const dashOffset = circumference * (1 - gaugePercent);
        
        // Use the sources from this specific finding
        const apis = f.apisUsed || [];
        const count = f.totalSources || apis.length;
        
        // Show "No sources" if empty
        const sourcesDisplay = apis.length > 0 ? 
            apis.map(api => `<span class="api-tag">${api}</span>`).join('') :
            '<span class="api-tag api-tag-none">No sources available</span>';
        
        // Detective insight box (purple) - only show if insight exists
        const insightBox = f.insight ? `
            <div class="detective-insight-box">
                <div class="detective-insight-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 16v-4M12 8h.01"/>
                    </svg>
                    <span>Detective's Insight</span>
                </div>
                <p class="detective-insight-text">"${esc(f.insight)}"</p>
                <span class="detective-insight-sig">— AI Detective</span>
            </div>
        ` : '';
        
        return `
            <div class="detective-card ${cardClass}">
                <div class="detective-card-header">
                    <span class="detective-card-type ${f.type}-type">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            ${f.type === 'red-flag' ? '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>' : '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'}
                        </svg>
                        ${f.typeLabel}
                    </span>
                    <div class="confidence-gauge">
                        <svg width="60" height="60" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="40" fill="none" stroke="#2a2a2a" stroke-width="8"/>
                            <circle cx="50" cy="50" r="40" fill="none" stroke="${gaugeColor}" stroke-width="8" 
                                stroke-dasharray="${circumference}" 
                                stroke-dashoffset="${dashOffset}"
                                stroke-linecap="round"
                                transform="rotate(-90 50 50)"/>
                        </svg>
                        <div class="confidence-value">
                            <span class="confidence-percent">${f.confidence}%</span>
                        </div>
                    </div>
                </div>
                <h3>${esc(f.title)}</h3>
                <p class="detective-card-description">${esc(f.description)}</p>
                ${f.entities.length > 0 ? `
                <div class="detective-entities">
                    ${f.entities.map(e => `<span class="entity-tag" data-search="${escAttr(e)}" onclick="doSearch(this.dataset.search)">${esc(e)}</span>`).join('')}
                </div>
                ` : ''}
                ${insightBox}
                <div class="detective-card-sources">
                    <div class="sources-header">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                        <span>${count > 0 ? `Analyzed ${count} sources:` : 'Sources:'}</span>
                    </div>
                    <div class="sources-list">
                        ${sourcesDisplay}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Update timestamp
    if (timeEl) {
        timeEl.textContent = new Date().toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }
}

// ============================================
// HELPER: Normalize text for deduplication
// ============================================

function normalizeForDedup(type, description) {
    // Normalize type
    const normType = (type || '').toLowerCase()
        .replace(/[_\s]+/g, '')
        .replace(/[^a-z0-9]/g, '');
    
    // Normalize description - extract key words
    const normDesc = (description || '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3)
        .slice(0, 5)
        .sort()
        .join('');
    
    return `${normType}-${normDesc}`;
}
