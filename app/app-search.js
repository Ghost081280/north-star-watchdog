/* ============================================
   NORTH STAR WATCHDOG - SEARCH MODULE
   All search functions and API calls
   ============================================ */

// ============================================
// MAIN SEARCH FUNCTION
// ============================================

async function performSearch(query) {
    // Validate query
    if (!query || typeof query !== 'string' || !query.trim()) {
        return;
    }
    
    currentQuery = query.trim();
    
    const section = document.getElementById('results-section');
    const loading = document.getElementById('loading-state');
    const content = document.getElementById('results-content');
    const deepResearch = document.getElementById('deep-research');
    const queryDisplay = document.getElementById('results-query');
    
    if (!section || !content) return;
    
    section.style.display = 'block';
    if (loading) loading.style.display = 'block';
    content.innerHTML = '';
    if (deepResearch) deepResearch.style.display = 'none';
    if (queryDisplay) queryDisplay.textContent = currentQuery;
    
    // Clear old AI analysis
    const existingAnalysis = document.getElementById('ai-analysis-result');
    if (existingAnalysis) existingAnalysis.remove();
    
    // Scroll to results with offset for sticky header
    setTimeout(function() {
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        const searchHeight = document.querySelector('.search-section')?.offsetHeight || 0;
        const offset = headerHeight + searchHeight + 20;
        const sectionTop = section.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: sectionTop, behavior: 'smooth' });
    }, 100);
    
    // Initialize results object with all categories
    currentResults = { 
        grants: [], 
        contracts: [], 
        nonprofits: [], 
        campaigns: [], 
        local: [],
        news: [],
        state: [],
        exclusions: []
    };
    webResearchResults = [];
    
    // Search local tracked data first (includes news now)
    searchLocalData(currentQuery);
    
    // Add Minnesota state database search links
    searchStateDatabases(currentQuery);
    
    // Fetch from APIs in parallel
    await Promise.allSettled([
        searchUSASpending(currentQuery, 'grants', ['02','03','04','05']),
        searchUSASpending(currentQuery, 'contracts', ['A','B','C','D']),
        searchProPublica(currentQuery),
        searchFEC(currentQuery)
    ]);
    
    // Add federal exclusion database search links
    searchFederalExclusions(currentQuery);
    
    if (loading) loading.style.display = 'none';
    renderResults();
}

// ============================================
// LOCAL DATA SEARCH (Our tracked data)
// ============================================

function searchLocalData(query) {
    if (!query) return;
    const q = query.toLowerCase();
    
    // Search investigations
    if (DATA.investigations?.cases) {
        DATA.investigations.cases.forEach(function(c) {
            if (c.name && c.name.toLowerCase().includes(q) || 
                (c.latestUpdate && c.latestUpdate.toLowerCase().includes(q))) {
                currentResults.local.push({ 
                    name: c.name, 
                    amount: c.amount, 
                    description: c.latestUpdate, 
                    source: 'Investigation', 
                    url: c.sourceUrl || 'https://www.justice.gov/usao-mn',
                    flagged: true 
                });
            }
        });
    }
    
    // Search key figures
    if (DATA.figures?.people) {
        DATA.figures.people.forEach(function(p) {
            if ((p.name && p.name.toLowerCase().includes(q)) ||
                (p.role && p.role.toLowerCase().includes(q)) ||
                (p.latestUpdate && p.latestUpdate.toLowerCase().includes(q))) {
                currentResults.local.push({ 
                    name: p.name, 
                    description: (p.role || '') + ' - ' + (p.latestUpdate || ''), 
                    source: 'Key Figure', 
                    url: p.sourceUrl || 'https://news.google.com/search?q=' + encodeURIComponent(p.name + ' Minnesota fraud'),
                    status: formatStatus(p.status), 
                    flagged: p.status !== 'cleared' 
                });
            }
        });
    }
    
    // Search news articles from news.json
    if (DATA.news?.articles) {
        DATA.news.articles.forEach(function(a) {
            if ((a.title && a.title.toLowerCase().includes(q)) ||
                (a.source && a.source.toLowerCase().includes(q))) {
                currentResults.news.push({
                    name: a.title,
                    description: 'From ' + (a.source || 'News') + ' - ' + (a.date || 'Recent'),
                    source: 'News',
                    url: a.link || '#',
                    date: a.date
                });
            }
        });
    }
    
    // Also check breaking news
    if (DATA.news?.breaking) {
        var b = DATA.news.breaking;
        if ((b.title && b.title.toLowerCase().includes(q)) ||
            (b.importance && b.importance.toLowerCase().includes(q))) {
            currentResults.news.unshift({
                name: '🔴 BREAKING: ' + b.title,
                description: b.importance || ('From ' + (b.source || 'Breaking News')),
                source: b.source || 'Breaking News',
                url: b.link || '#',
                isBreaking: true
            });
        }
    }
    
    // Search trending topics
    if (DATA.trending?.topics) {
        DATA.trending.topics.forEach(function(t) {
            if ((t.topic && t.topic.toLowerCase().includes(q)) ||
                (t.reason && t.reason.toLowerCase().includes(q))) {
                currentResults.local.push({
                    name: t.topic,
                    description: t.reason,
                    source: 'Trending Topic',
                    url: 'https://news.google.com/search?q=' + encodeURIComponent(t.topic + ' Minnesota'),
                    isNew: t.isNew
                });
            }
        });
    }
    
    // Search red flags
    if (DATA.redFlags?.flags) {
        DATA.redFlags.flags.forEach(function(f) {
            if ((f.description && f.description.toLowerCase().includes(q)) ||
                (f.entities && f.entities.some(function(e) { return e.toLowerCase().includes(q); }))) {
                currentResults.local.push({
                    name: '🚩 ' + (f.type || 'Red Flag'),
                    description: f.description,
                    source: 'AI Detective',
                    url: f.sourceUrl || '#',
                    priority: f.priority,
                    flagged: true
                });
            }
        });
    }
}

// ============================================
// MINNESOTA STATE DATABASES
// ============================================

function searchStateDatabases(query) {
    if (!query) return;
    
    currentResults.state = [
        {
            name: 'MN DHS Licensing Lookup',
            description: 'Search daycare licenses, revocations, sanctions',
            source: 'MN DHS',
            url: 'https://licensinglookup.dhs.state.mn.us/',
            searchQuery: query
        },
        {
            name: 'MN Secretary of State',
            description: 'Search business registrations, LLC filings',
            source: 'MN SOS',
            url: 'https://mblsportal.sos.mn.gov/Business/Search',
            searchQuery: query
        },
        {
            name: 'MN Campaign Finance Board',
            description: 'Search campaign donations, political spending',
            source: 'MN CFB',
            url: 'https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?ContributorName=' + encodeURIComponent(query),
            searchQuery: query
        },
        {
            name: 'MN Courts (MCRO)',
            description: 'Search Minnesota state court cases',
            source: 'MN Courts',
            url: 'https://publicaccess.courts.state.mn.us/CaseSearch',
            searchQuery: query
        },
        {
            name: 'MN Transparency Portal',
            description: 'Search state vendor payments and contracts',
            source: 'MN MMB',
            url: 'https://mn.gov/mmb/transparency-mn/',
            searchQuery: query
        }
    ];
}

// ============================================
// FEDERAL EXCLUSION DATABASES
// ============================================

function searchFederalExclusions(query) {
    if (!query) return;
    
    currentResults.exclusions = [
        {
            name: 'OIG LEIE Exclusions',
            description: 'Check if excluded from Medicare, Medicaid, federal healthcare',
            source: 'HHS OIG',
            url: 'https://exclusions.oig.hhs.gov/',
            searchQuery: query
        },
        {
            name: 'SAM.gov Exclusions',
            description: 'Check federal debarment and suspension list',
            source: 'SAM.gov',
            url: 'https://sam.gov/search/?index=ei&sort=-modifiedDate',
            searchQuery: query
        },
        {
            name: 'HHS TAGGS',
            description: 'Search HHS grants to Minnesota organizations',
            source: 'HHS',
            url: 'https://taggs.hhs.gov/SearchAward',
            searchQuery: query
        },
        {
            name: 'Federal Audit Clearinghouse',
            description: 'Check audits of nonprofits spending $750K+ federal funds',
            source: 'Census Bureau',
            url: 'https://facweb.census.gov/uploadpdf.aspx',
            searchQuery: query
        },
        {
            name: 'OFAC Sanctions Search',
            description: 'Search Treasury sanctions and blocked persons list',
            source: 'Treasury OFAC',
            url: 'https://sanctionssearch.ofac.treas.gov/',
            searchQuery: query
        },
        {
            name: 'IRS Tax Exempt Search',
            description: 'Search 501c status, 990s, and revocations',
            source: 'IRS',
            url: 'https://apps.irs.gov/app/eos/',
            searchQuery: query
        }
    ];
}

// ============================================
// USA SPENDING API
// ============================================

async function searchUSASpending(query, type, codes) {
    if (!query) return;
    
    try {
        const res = await fetch(CONFIG.USA_SPENDING + '/search/spending_by_award/', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                filters: { 
                    keywords: [query], 
                    recipient_locations: [{ country: 'USA', state: 'MN' }], 
                    award_type_codes: codes 
                }, 
                fields: ['Recipient Name', 'Award Amount', 'Description', 'Award ID'], 
                page: 1, 
                limit: 10, 
                sort: 'Award Amount', 
                order: 'desc' 
            })
        });
        
        if (res.ok) {
            const data = await res.json();
            currentResults[type] = (data.results || []).map(function(r) {
                return { 
                    name: r['Recipient Name'] || 'Unknown', 
                    amount: r['Award Amount'] || 0, 
                    description: r['Description'] || ('Federal ' + type), 
                    source: 'USASpending',
                    url: 'https://www.usaspending.gov/search/?hash=' + encodeURIComponent(query)
                };
            });
        }
    } catch (e) {
        // Silent fail
    }
}

// ============================================
// PROPUBLICA NONPROFITS API
// ============================================

async function searchProPublica(query) {
    if (!query) return;
    
    try {
        const url = CONFIG.PROPUBLICA + '/search.json?q=' + encodeURIComponent(query) + '&state[id]=MN';
        const res = await fetch(CONFIG.CORS_PROXY + encodeURIComponent(url));
        
        if (res.ok) {
            const data = await res.json();
            currentResults.nonprofits = (data.organizations || []).slice(0, 10).map(function(o) {
                return { 
                    name: o.name, 
                    amount: o.income_amount || 0, 
                    description: 'EIN: ' + o.ein, 
                    source: 'ProPublica', 
                    url: 'https://projects.propublica.org/nonprofits/organizations/' + o.ein
                };
            });
        }
    } catch (e) {
        // Silent fail
    }
}

// ============================================
// FEC CAMPAIGN FINANCE API
// ============================================

async function searchFEC(query) {
    if (!query) return;
    
    try {
        const res = await fetch(
            CONFIG.FEC + '/committees/?api_key=' + CONFIG.FEC_KEY + '&q=' + encodeURIComponent(query) + '&state=MN&per_page=10'
        );
        
        if (res.ok) {
            const data = await res.json();
            currentResults.campaigns = (data.results || []).map(function(c) {
                return { 
                    name: c.name, 
                    amount: c.receipts || 0, 
                    description: c.designation_full || '', 
                    source: 'FEC', 
                    url: 'https://www.fec.gov/data/committee/' + c.committee_id + '/'
                };
            });
        }
    } catch (e) {
        // Silent fail
    }
}

// ============================================
// GOOGLE NEWS RSS FETCH
// ============================================

async function fetchGoogleNews(searchTerm) {
    if (!searchTerm) return [];
    
    const terms = [
        searchTerm + ' Minnesota fraud',
        searchTerm + ' Minnesota investigation'
    ];
    
    const allArticles = [];
    
    for (var i = 0; i < terms.length; i++) {
        var term = terms[i];
        var url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(term) + '&hl=en-US&gl=US&ceid=US:en';
        
        try {
            var res = await fetch(CONFIG.CORS_PROXY + encodeURIComponent(url));
            if (!res.ok) continue;
            
            var text = await res.text();
            var itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];
            
            for (var j = 0; j < Math.min(itemMatches.length, 5); j++) {
                var item = itemMatches[j];
                var titleMatch = item.match(/<title>(.*?)<\/title>/);
                var linkMatch = item.match(/<link>(.*?)<\/link>/);
                var dateMatch = item.match(/<pubDate>(.*?)<\/pubDate>/);
                
                var title = titleMatch ? titleMatch[1] : '';
                var link = linkMatch ? linkMatch[1] : '';
                var pubDate = dateMatch ? dateMatch[1] : '';
                
                var cleanTitle = title
                    .replace(/<!\[CDATA\[|\]\]>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
                    
                var dashIdx = cleanTitle.lastIndexOf(' - ');
                var source = dashIdx > -1 ? cleanTitle.substring(dashIdx + 3) : 'News';
                cleanTitle = dashIdx > -1 ? cleanTitle.substring(0, dashIdx) : cleanTitle;
                
                if (cleanTitle && link) {
                    allArticles.push({
                        title: cleanTitle,
                        source: source,
                        link: link,
                        date: pubDate ? new Date(pubDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        }) : 'Recent'
                    });
                }
            }
        } catch (e) {
            // Silent fail
        }
    }
    
    // Deduplicate by title
    var seen = {};
    return allArticles.filter(function(a) {
        var key = a.title.toLowerCase().substring(0, 50);
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });
}
