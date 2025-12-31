/* ============================================
   NORTH STAR WATCHDOG - RESEARCH MODULE
   Deep research and AI analysis functions
   ============================================ */

// ============================================
// DEEP RESEARCH MAIN FUNCTION
// ============================================

async function doDeepResearch() {
    const deepResearch = document.getElementById('deep-research');
    deepResearch.style.display = 'block';
    
    // Scroll to deep research with offset for sticky header
    setTimeout(() => {
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const searchHeight = document.querySelector('.search-section')?.offsetHeight || 0;
        const offset = headerHeight + searchHeight + 20;
        const sectionTop = deepResearch.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: sectionTop, behavior: 'smooth' });
    }, 100);
    
    const q = encodeURIComponent(currentQuery + ' Minnesota fraud');
    
    // Render video & social links (expanded)
    renderVideoSocialLinks(q);
    
    // Render court/gov/OSINT links (expanded to 20+)
    renderCourtGovLinks(q);
    
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
    
    // Run AI analysis
    await runAIAnalysis();
}

// ============================================
// VIDEO & SOCIAL LINKS (EXPANDED)
// ============================================

function renderVideoSocialLinks(q) {
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
        <a href="https://www.facebook.com/search/top?q=${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
        </a>
        <a href="https://www.instagram.com/explore/tags/${encodeURIComponent(currentQuery.replace(/\s+/g, ''))}/" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Instagram
        </a>
        <a href="https://www.linkedin.com/search/results/all/?keywords=${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
            LinkedIn
        </a>
    `;
}

// ============================================
// COURT, GOVERNMENT & OSINT LINKS (EXPANDED TO 20+)
// ============================================

function renderCourtGovLinks(q) {
    const qName = encodeURIComponent(currentQuery);
    
    document.getElementById('court-links').innerHTML = `
        <!-- Federal Law Enforcement -->
        <a href="https://www.google.com/search?q=site:justice.gov/usao-mn+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M12 3l9 7H3l9-7z"/></svg>
            DOJ Minnesota
        </a>
        <a href="https://www.courtlistener.com/?q=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Court Listener RECAP
        </a>
        <a href="https://dockets.justia.com/?q=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>
            Justia Dockets
        </a>
        <a href="https://unicourt.com/case/search?q=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            UniCourt
        </a>
        <a href="https://www.google.com/search?q=site:oversight.house.gov+minnesota+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M9 21V8l-6 4v9m12 0V8l6 4v9M12 3l9 7H3l9-7z"/></svg>
            House Oversight
        </a>
        <a href="https://vault.fbi.gov/search?SearchableText=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            FBI Vault
        </a>
        
        <!-- Minnesota State -->
        <a href="https://licensinglookup.dhs.state.mn.us/" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/></svg>
            MN DHS Licensing
        </a>
        <a href="https://exclusions.oig.hhs.gov/" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            OIG Exclusions
        </a>
        <a href="https://sam.gov/search/?index=ei&keywords=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            SAM.gov Exclusions
        </a>
        <a href="https://mblsportal.sos.mn.gov/Business/Search" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
            MN Secretary of State
        </a>
        <a href="https://cfb.mn.gov/reports/" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            MN Campaign Finance
        </a>
        <a href="https://publicaccess.courts.state.mn.us/CaseSearch" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18M3 10h18M5 6l7-3 7 3"/></svg>
            MN State Courts
        </a>
        
        <!-- Political Money -->
        <a href="https://www.opensecrets.org/search?q=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M8 10l4-4 4 4M8 14l4 4 4-4"/></svg>
            OpenSecrets
        </a>
        <a href="https://www.opensecrets.org/donor-lookup?name=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
            OpenSecrets Donors
        </a>
        
        <!-- Nonprofits -->
        <a href="https://www.guidestar.org/search?q=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            Candid/GuideStar
        </a>
        <a href="https://apps.irs.gov/app/eos/" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
            IRS Tax Exempt
        </a>
        
        <!-- OSINT Tools -->
        <a href="https://opencorporates.com/companies?jurisdiction_code=us_mn&q=${qName}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>
            OpenCorporates MN
        </a>
        <a href="https://web.archive.org/web/*/${encodeURIComponent(currentQuery)}*" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Wayback Machine
        </a>
        <a href="https://sanctionssearch.ofac.treas.gov/" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            OFAC Sanctions
        </a>
        
        <!-- Minnesota News -->
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
        <a href="https://www.google.com/search?q=site:kare11.com+${q}" target="_blank" rel="noopener" class="research-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 9l5 3-5 3V9z"/></svg>
            KARE 11
        </a>
    `;
}

// ============================================
// AI ANALYSIS (calls Cloudflare Worker)
// ============================================

async function runAIAnalysis() {
    const aiSection = document.querySelector('.ai-section');
    
    // Remove any existing analysis result first
    const existingAnalysis = document.getElementById('ai-analysis-result');
    if (existingAnalysis) existingAnalysis.remove();
    
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

// ============================================
// AI PROMPT BUILDERS
// ============================================

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
    
    if (currentResults.contracts.length) {
        prompt += `\nFEDERAL CONTRACTS:\n`;
        currentResults.contracts.slice(0, 5).forEach(r => prompt += `- ${r.name}: ${fmt(r.amount)}\n`);
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
    
    if (currentResults.contracts.length) {
        prompt += `\nFEDERAL CONTRACTS:\n`;
        currentResults.contracts.slice(0, 5).forEach(r => prompt += `- ${r.name}: ${fmt(r.amount)}\n`);
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

// ============================================
// AI RESPONSE FORMATTER
// ============================================

function formatAIResponse(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/^### (.*$)/gm, '<h6>$1</h6>')
        .replace(/^## (.*$)/gm, '<h5>$1</h5>')
        .replace(/^# (.*$)/gm, '<h5>$1</h5>')
        .replace(/^\d+\.\s+\*\*(.*?)\*\*:?\s*/gm, '<p><strong>$1:</strong> ')
        .replace(/^\d+\.\s+(.*$)/gm, '<p>$1</p>')
        .replace(/^- (.*$)/gm, '<p>$1</p>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>');
}

// ============================================
// COPY PROMPT FUNCTION
// ============================================

function copyPrompt() {
    const prompt = document.getElementById('ai-prompt');
    prompt.select();
    prompt.setSelectionRange(0, 99999);
    
    navigator.clipboard.writeText(prompt.value).then(() => {
        const btn = document.getElementById('copy-prompt-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg> Copied!';
        btn.style.background = '#22c55e';
        setTimeout(() => { 
            btn.innerHTML = originalHTML; 
            btn.style.background = ''; 
        }, 2000);
    }).catch(() => {
        document.execCommand('copy');
    });
}
