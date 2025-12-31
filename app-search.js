/* ============================================
   NORTH STAR WATCHDOG - SEARCH MODULE
   All search functions and API calls
   ============================================ */

// ============================================
// MAIN SEARCH FUNCTION
// ============================================

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
    
    // Clear old AI analysis
    const existingAnalysis = document.getElementById('ai-analysis-result');
    if (existingAnalysis) existingAnalysis.remove();
    
    // Scroll to results with offset for sticky header
    setTimeout(() => {
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
        state: [],      // NEW: Minnesota state databases
        exclusions: []  // NEW: Federal exclusion databases
    };
    webResearchResults = [];
    
    // Search local tracked data first
    searchLocalData(query);
    
    // Add Minnesota state database search links
    searchStateDatabases(query);
    
    // Fetch from APIs in parallel
    await Promise.allSettled([
        searchUSASpending(query, 'grants', ['02','03','04','05']),
        searchUSASpending(query, 'contracts', ['A','B','C','D']),
        searchProPublica(query),
        searchFEC(query)
    ]);
    
    // Add federal exclusion database search links
    searchFederalExclusions(query);
    
    loading.style.display = 'none';
    renderResults();
}

// ============================================
// LOCAL DATA SEARCH (Our tracked data)
// ============================================

function searchLocalData(query) {
    const q = query.toLowerCase();
    
    // Search investigations
    DATA.investigations?.cases?.forEach(c => {
        if (c.name.toLowerCase().includes(q)) {
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
    
    // Search key figures
    DATA.figures?.people?.forEach(p => {
        if (p.name.toLowerCase().includes(q)) {
            currentResults.local.push({ 
                name: p.name, 
                description: `${p.role} - ${p.latestUpdate}`, 
                source: 'Key Figure', 
                url: p.sourceUrl || `https://news.google.com/search?q=${encodeURIComponent(p.name + ' Minnesota fraud')}`,
                status: formatStatus(p.status), 
                flagged: p.status !== 'cleared' 
            });
        }
    });
}

// ============================================
// MINNESOTA STATE DATABASES (NEW)
// ============================================

function searchStateDatabases(query) {
    const q = encodeURIComponent(query);
    
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
            url: 'https://cfb.mn.gov/reports/',
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
            name: 'MN County Property Records',
            description: 'Search property ownership across 87 counties',
            source: 'County Records',
            url: 'https://publicrecords.netronline.com/state/MN',
            searchQuery: query
        }
    ];
}

// ============================================
// FEDERAL EXCLUSION DATABASES (NEW)
// ============================================

function searchFederalExclusions(query) {
    const q = encodeURIComponent(query);
    
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
    try {
        const res = await fetch(`${CONFIG.USA_SPENDING}/search/spending_by_award/`, {
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
            currentResults[type] = (data.results || []).map(r => ({ 
                name: r['Recipient Name'] || 'Unknown', 
                amount: r['Award Amount'] || 0, 
                description: r['Description'] || `Federal ${type}`, 
                source: 'USASpending',
                url: `https://www.usaspending.gov/search/?hash=${encodeURIComponent(query)}`
            }));
        }
    } catch (e) {
        console.log(`USASpending ${type} search error:`, e);
    }
}

// ============================================
// PROPUBLICA NONPROFITS API
// ============================================

async function searchProPublica(query) {
    try {
        const url = `${CONFIG.PROPUBLICA}/search.json?q=${encodeURIComponent(query)}&state[id]=MN`;
        const res = await fetch(`${CONFIG.CORS_PROXY}${encodeURIComponent(url)}`);
        
        if (res.ok) {
            const data = await res.json();
            currentResults.nonprofits = (data.organizations || []).slice(0, 10).map(o => ({ 
                name: o.name, 
                amount: o.income_amount || 0, 
                description: `EIN: ${o.ein}`, 
                source: 'ProPublica', 
                url: `https://projects.propublica.org/nonprofits/organizations/${o.ein}` 
            }));
        }
    } catch (e) {
        console.log('ProPublica search error:', e);
    }
}

// ============================================
// FEC CAMPAIGN FINANCE API
// ============================================

async function searchFEC(query) {
    try {
        const res = await fetch(
            `${CONFIG.FEC}/committees/?api_key=${CONFIG.FEC_KEY}&q=${encodeURIComponent(query)}&state=MN&per_page=10`
        );
        
        if (res.ok) {
            const data = await res.json();
            currentResults.campaigns = (data.results || []).map(c => ({ 
                name: c.name, 
                amount: c.receipts || 0, 
                description: c.designation_full || '', 
                source: 'FEC', 
                url: `https://www.fec.gov/data/committee/${c.committee_id}/` 
            }));
        }
    } catch (e) {
        console.log('FEC search error:', e);
    }
}

// ============================================
// GOOGLE NEWS RSS FETCH
// ============================================

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
                
                let cleanTitle = title
                    .replace(/<!\[CDATA\[|\]\]>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#39;/g, "'");
                    
                const dashIdx = cleanTitle.lastIndexOf(' - ');
                const source = dashIdx > -1 ? cleanTitle.substring(dashIdx + 3) : 'News';
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
            console.log('News fetch error:', e);
        }
    }
    
    // Deduplicate by title
    const seen = new Set();
    return allArticles.filter(a => {
        const key = a.title.toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
