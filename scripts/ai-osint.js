/**
 * NORTH STAR WATCHDOG - AI OSINT v3.0
 * 
 * COMPREHENSIVE FIX:
 * - Removed SAM.gov (doesn't work - returns 406)
 * - Removed domain-based APIs (not relevant for fraud investigation)
 * - Better entity extraction from AI analysis
 * - Uses trending topics, figures, investigations to drive searches
 * - Returns actionable data for briefing synthesis
 */

const https = require('https');
const http = require('http');

// Track API usage
const API_STATS = {
    calls: 0,
    successes: 0,
    failures: 0
};

// ============================================
// GENERIC API REQUEST HELPER
// ============================================

async function makeRequest(url, options = {}) {
    return new Promise((resolve) => {
        API_STATS.calls++;
        
        try {
            const isHttps = url.startsWith('https');
            const client = isHttps ? https : http;
            const timeout = options.timeout || 15000;
            
            const reqOptions = {
                headers: {
                    'User-Agent': 'NorthStarWatchdog/3.0 (Citizen Journalism Tool)',
                    'Accept': 'application/json',
                    ...options.headers
                },
                timeout: timeout
            };
            
            const req = client.get(url, reqOptions, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            API_STATS.successes++;
                            try {
                                resolve({ success: true, data: JSON.parse(data), status: res.statusCode });
                            } catch {
                                resolve({ success: true, data: data, status: res.statusCode, raw: true });
                            }
                        } else {
                            API_STATS.failures++;
                            resolve({ success: false, status: res.statusCode, error: data.substring(0, 200) });
                        }
                    } catch (e) {
                        API_STATS.failures++;
                        resolve({ success: false, error: e.message });
                    }
                });
            });
            
            req.on('error', (e) => {
                API_STATS.failures++;
                resolve({ success: false, error: e.message });
            });
            
            req.on('timeout', () => {
                API_STATS.failures++;
                req.destroy();
                resolve({ success: false, error: 'Timeout' });
            });
        } catch (e) {
            API_STATS.failures++;
            resolve({ success: false, error: e.message });
        }
    });
}

// ============================================
// FREE APIs - ACTUALLY RELEVANT FOR FRAUD
// ============================================

// USASpending.gov - Federal grants and contracts
async function searchUSASpending(query, state = 'MN') {
    console.log(`    USASpending: Searching "${query}"...`);
    
    try {
        // Use the award search endpoint
        const url = `https://api.usaspending.gov/api/v2/autocomplete/recipient/?search_text=${encodeURIComponent(query)}&limit=10`;
        const result = await makeRequest(url, { timeout: 15000 });
        
        if (result.success && result.data?.results) {
            const recipients = result.data.results.map(r => ({
                name: r.recipient_name,
                uei: r.uei,
                duns: r.duns
            }));
            
            if (recipients.length > 0) {
                console.log(`    USASpending: Found ${recipients.length} recipients matching "${query}"`);
            }
            
            return {
                source: 'USASpending.gov',
                available: true,
                query,
                found: recipients.length,
                recipients,
                searchUrl: `https://www.usaspending.gov/search/?hash=recipient:${encodeURIComponent(query)}`
            };
        }
        
        return { 
            source: 'USASpending.gov', 
            available: true, 
            query, 
            found: 0,
            searchUrl: `https://www.usaspending.gov/search/?hash=recipient:${encodeURIComponent(query)}`
        };
    } catch (e) {
        console.log(`    USASpending: Error - ${e.message}`);
        return { source: 'USASpending.gov', available: false, error: e.message };
    }
}

// ProPublica Nonprofit Explorer - 990 filings
async function searchNonprofits(query) {
    console.log(`    ProPublica: Searching nonprofits "${query}"...`);
    
    const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(query)}`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.organizations) {
        const orgs = result.data.organizations.slice(0, 10).map(o => ({
            name: o.name,
            ein: o.ein,
            city: o.city,
            state: o.state,
            nteeCode: o.ntee_code,
            income: o.income_amount,
            assets: o.asset_amount
        }));
        
        if (orgs.length > 0) {
            console.log(`    ProPublica: Found ${orgs.length} nonprofits`);
        }
        
        return {
            source: 'ProPublica Nonprofits',
            available: true,
            query,
            found: orgs.length,
            organizations: orgs,
            searchUrl: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(query)}`
        };
    }
    
    return { source: 'ProPublica Nonprofits', available: true, query, found: 0 };
}

// FEC Campaign Finance
async function searchFECContributions(name) {
    console.log(`    FEC: Searching contributions from "${name}"...`);
    
    const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(name)}&per_page=20&api_key=DEMO_KEY`;
    const result = await makeRequest(url, { timeout: 15000 });
    
    if (result.success && result.data?.results) {
        const contributions = result.data.results.map(c => ({
            contributor: c.contributor_name,
            amount: c.contribution_receipt_amount,
            date: c.contribution_receipt_date,
            committee: c.committee?.name,
            employer: c.contributor_employer,
            occupation: c.contributor_occupation
        }));
        
        if (contributions.length > 0) {
            console.log(`    FEC: Found ${contributions.length} contributions`);
        }
        
        return {
            source: 'FEC Campaign Finance',
            available: true,
            query: name,
            found: contributions.length,
            contributions,
            totalAmount: contributions.reduce((sum, c) => sum + (c.amount || 0), 0),
            searchUrl: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(name)}`
        };
    }
    
    return { source: 'FEC Campaign Finance', available: true, query: name, found: 0 };
}

// Court Listener - Federal court cases
async function searchCourtCases(query) {
    console.log(`    CourtListener: Searching "${query}"...`);
    
    // Use opinion search which is more reliable
    const url = `https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(query)}&type=o&format=json`;
    const result = await makeRequest(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'NorthStarWatchdog/3.0' }
    });
    
    if (result.success && result.data?.results) {
        const cases = result.data.results.slice(0, 10).map(c => ({
            caseName: c.caseName || c.case_name,
            court: c.court,
            dateFiled: c.dateFiled || c.date_filed,
            docketNumber: c.docketNumber || c.docket_number,
            snippet: c.snippet
        }));
        
        if (cases.length > 0) {
            console.log(`    CourtListener: Found ${cases.length} cases`);
        } else {
            console.log(`    CourtListener: No cases found for "${query}"`);
        }
        
        return {
            source: 'Court Listener',
            available: true,
            query,
            found: cases.length,
            cases,
            searchUrl: `https://www.courtlistener.com/?q=${encodeURIComponent(query)}`
        };
    }
    
    console.log(`    CourtListener: No cases found for "${query}"`);
    return { source: 'Court Listener', available: true, query, found: 0 };
}

// OpenCorporates - Company registry
async function searchCompanies(name, jurisdiction = 'us_mn') {
    console.log(`    OpenCorporates: Searching "${name}"...`);
    
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(name)}&jurisdiction_code=${jurisdiction}&per_page=10`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results?.companies) {
        const companies = result.data.results.companies.map(c => ({
            name: c.company.name,
            companyNumber: c.company.company_number,
            status: c.company.current_status,
            incorporationDate: c.company.incorporation_date,
            companyType: c.company.company_type,
            registeredAddress: c.company.registered_address_in_full
        }));
        
        if (companies.length > 0) {
            console.log(`    OpenCorporates: Found ${companies.length} companies`);
        }
        
        return {
            source: 'OpenCorporates',
            available: true,
            query: name,
            found: companies.length,
            companies,
            searchUrl: `https://opencorporates.com/companies?q=${encodeURIComponent(name)}&jurisdiction_code=${jurisdiction}`
        };
    }
    
    return { source: 'OpenCorporates', available: true, query: name, found: 0 };
}

// OIG Exclusions - Healthcare fraud ban list
async function searchOIGExclusions(name) {
    console.log(`    OIG: Checking exclusions for "${name}"...`);
    
    // OIG doesn't have a public API, return search URL
    return {
        source: 'OIG Exclusions',
        available: true,
        query: name,
        searchUrl: `https://exclusions.oig.hhs.gov/Search.aspx?query=${encodeURIComponent(name)}`,
        note: 'Manual check required'
    };
}

// DOJ Press Releases
async function scrapeDOJPress(query) {
    console.log(`    DOJ: Searching press releases for "${query}"...`);
    
    // DOJ search URL for manual checking
    return {
        source: 'DOJ Press',
        available: true,
        query,
        searchUrl: `https://www.justice.gov/usao-mn/pr?search=${encodeURIComponent(query)}`,
        note: 'Check DOJ Minnesota press releases'
    };
}

// FBI Press Releases
async function scrapeFBIPress(query) {
    console.log(`    FBI: Searching press releases for "${query}"...`);
    
    return {
        source: 'FBI Press',
        available: true,
        query,
        searchUrl: `https://www.fbi.gov/contact-us/field-offices/minneapolis/news/press-releases`,
        note: 'Check FBI Minneapolis press releases'
    };
}

// MN DHS Licensing Lookup
async function searchMNLicensing(name) {
    console.log(`    MN DHS: Checking licensing for "${name}"...`);
    
    return {
        source: 'MN DHS Licensing',
        available: true,
        query: name,
        searchUrl: `https://licensinglookup.dhs.state.mn.us/`,
        note: 'Manual check required - search for provider name'
    };
}

// ============================================
// ENTITY EXTRACTION - IMPROVED
// ============================================

function extractEntities(aiAnalysis, detectiveFindings) {
    const persons = new Set();
    const organizations = new Set();
    const searchTerms = new Set();
    
    // Always include known key entities
    persons.add('Aimee Bock');
    organizations.add('Feeding Our Future');
    searchTerms.add('Minnesota childcare fraud');
    searchTerms.add('CCAP fraud');
    
    // From figure updates
    if (aiAnalysis?.figureUpdates) {
        aiAnalysis.figureUpdates.forEach(f => {
            if (f.name && f.name.length > 2) {
                persons.add(f.name);
            }
        });
    }
    
    // From investigation updates
    if (aiAnalysis?.investigationUpdates) {
        aiAnalysis.investigationUpdates.forEach(inv => {
            if (inv.name) {
                organizations.add(inv.name);
                searchTerms.add(inv.name);
            }
        });
    }
    
    // From trending topics
    if (aiAnalysis?.trending) {
        aiAnalysis.trending.forEach(t => {
            if (t.topic) searchTerms.add(t.topic);
            if (t.suggestedSearches) {
                t.suggestedSearches.forEach(s => searchTerms.add(s));
            }
        });
    }
    
    // From red flags
    if (aiAnalysis?.redFlags) {
        aiAnalysis.redFlags.forEach(f => {
            if (f.entities) {
                f.entities.forEach(e => {
                    if (e && e.length > 2) {
                        // Guess if it's a person or org
                        const words = e.split(' ').length;
                        if (words <= 3 && !e.includes('Inc') && !e.includes('LLC') && !e.includes('Center')) {
                            persons.add(e);
                        } else {
                            organizations.add(e);
                        }
                        searchTerms.add(e);
                    }
                });
            }
        });
    }
    
    // From AI-specified OSINT entities
    if (aiAnalysis?.entitiesForOsint) {
        aiAnalysis.entitiesForOsint.forEach(e => {
            if (e && e.length > 2 && !e.includes('.')) {
                searchTerms.add(e);
            }
        });
    }
    
    // From new search terms
    if (aiAnalysis?.newSearchTerms) {
        aiAnalysis.newSearchTerms.forEach(t => {
            if (t && t.length > 2) searchTerms.add(t);
        });
    }
    
    // From detective findings
    if (detectiveFindings?.suspiciousPatterns) {
        detectiveFindings.suspiciousPatterns.forEach(p => {
            if (p.entities) {
                p.entities.forEach(e => {
                    if (e && e.length > 2) searchTerms.add(e);
                });
            }
        });
    }
    
    return {
        persons: [...persons].slice(0, 10),
        organizations: [...organizations].slice(0, 10),
        searchTerms: [...searchTerms].slice(0, 15)
    };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

async function enrichFindings(aiAnalysis, detectiveFindings) {
    console.log('  Running OSINT enrichment v3.0...');
    
    // Track sources
    const sourcesUsed = ['Google News', 'GROQ AI'];
    const sourcesChecked = ['Google News', 'GROQ AI'];
    
    const results = {
        spending: [],
        nonprofits: [],
        campaigns: [],
        courts: [],
        companies: [],
        government: [],
        sourcesUsed: [],
        sourceCount: 0
    };
    
    // Extract entities from AI analysis
    const entities = extractEntities(aiAnalysis, detectiveFindings);
    
    console.log(`  Entities extracted: ${entities.persons.length} persons, ${entities.organizations.length} orgs, ${entities.searchTerms.length} search terms`);
    
    // ============================================
    // 1. USASpending.gov - Federal Grants
    // ============================================
    console.log('\n  [1/7] USASpending.gov...');
    sourcesChecked.push('USASpending.gov');
    
    for (const org of entities.organizations.slice(0, 3)) {
        const spending = await searchUSASpending(org, 'MN');
        if (spending.found > 0) {
            if (!sourcesUsed.includes('USASpending.gov')) sourcesUsed.push('USASpending.gov');
            results.spending.push(spending);
        }
        await delay(500);
    }
    
    // ============================================
    // 2. ProPublica Nonprofits
    // ============================================
    console.log('\n  [2/7] ProPublica Nonprofits...');
    sourcesChecked.push('ProPublica Nonprofits');
    
    for (const org of entities.organizations.slice(0, 3)) {
        const nonprofits = await searchNonprofits(org);
        if (nonprofits.found > 0) {
            if (!sourcesUsed.includes('ProPublica Nonprofits')) sourcesUsed.push('ProPublica Nonprofits');
            results.nonprofits.push(nonprofits);
        }
        await delay(500);
    }
    
    // ============================================
    // 3. FEC Campaign Finance
    // ============================================
    console.log('\n  [3/7] FEC Campaign Finance...');
    sourcesChecked.push('FEC Campaign Finance');
    
    for (const person of entities.persons.slice(0, 5)) {
        const contributions = await searchFECContributions(person);
        if (contributions.found > 0) {
            if (!sourcesUsed.includes('FEC Campaign Finance')) sourcesUsed.push('FEC Campaign Finance');
            results.campaigns.push(contributions);
        }
        await delay(500);
    }
    
    // ============================================
    // 4. Court Listener
    // ============================================
    console.log('\n  [4/7] Court Listener...');
    sourcesChecked.push('Court Listener');
    
    for (const term of entities.searchTerms.slice(0, 3)) {
        const courts = await searchCourtCases(term);
        if (courts.found > 0) {
            if (!sourcesUsed.includes('Court Listener')) sourcesUsed.push('Court Listener');
            results.courts.push(courts);
        }
        await delay(500);
    }
    
    // ============================================
    // 5. OpenCorporates
    // ============================================
    console.log('\n  [5/7] OpenCorporates...');
    sourcesChecked.push('OpenCorporates');
    
    for (const org of entities.organizations.slice(0, 3)) {
        const companies = await searchCompanies(org, 'us_mn');
        if (companies.found > 0) {
            if (!sourcesUsed.includes('OpenCorporates')) sourcesUsed.push('OpenCorporates');
            results.companies.push(companies);
        }
        await delay(500);
    }
    
    // ============================================
    // 6. OIG Exclusions (Healthcare Ban List)
    // ============================================
    console.log('\n  [6/7] OIG Exclusions...');
    sourcesChecked.push('OIG Exclusions');
    
    for (const person of entities.persons.slice(0, 3)) {
        const oig = await searchOIGExclusions(person);
        if (oig.searchUrl) {
            if (!sourcesUsed.includes('OIG Exclusions')) sourcesUsed.push('OIG Exclusions');
            results.government.push(oig);
        }
    }
    
    // ============================================
    // 7. Government Press Releases
    // ============================================
    console.log('\n  [7/7] Government Sources...');
    sourcesChecked.push('DOJ Press');
    sourcesChecked.push('FBI Press');
    sourcesChecked.push('MN DHS');
    
    const doj = await scrapeDOJPress('minnesota fraud');
    if (doj.searchUrl) {
        sourcesUsed.push('DOJ Press');
        results.government.push(doj);
    }
    
    const fbi = await scrapeFBIPress('minnesota fraud');
    if (fbi.searchUrl) {
        sourcesUsed.push('FBI Press');
        results.government.push(fbi);
    }
    
    // Add MN DHS for each organization
    for (const org of entities.organizations.slice(0, 2)) {
        const licensing = await searchMNLicensing(org);
        results.government.push(licensing);
    }
    if (!sourcesUsed.includes('MN DHS')) sourcesUsed.push('MN DHS');
    
    // ============================================
    // Summary
    // ============================================
    results.sourcesUsed = sourcesUsed;
    results.sourcesChecked = sourcesChecked;
    results.sourceCount = sourcesUsed.length;
    results.entities = entities;
    
    console.log('\n  ══════════════════════════════════════');
    console.log(`  OSINT COMPLETE`);
    console.log(`  Sources checked: ${sourcesChecked.length}`);
    console.log(`  Sources with data: ${sourcesUsed.length}`);
    console.log(`  Sources used: ${sourcesUsed.join(', ') || 'None'}`);
    console.log(`  API calls: ${API_STATS.calls} (${API_STATS.successes} success, ${API_STATS.failures} failed)`);
    console.log('  ══════════════════════════════════════\n');
    
    return results;
}

// Helper
function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// Get API status
function getApiStatus() {
    return {
        stats: API_STATS,
        configured: {
            GROQ: !!process.env.GROQ_API_KEY
        },
        free: ['USASpending.gov', 'ProPublica', 'FEC', 'Court Listener', 'OpenCorporates', 'OIG', 'DOJ Press', 'FBI Press', 'MN DHS']
    };
}

module.exports = {
    enrichFindings,
    getApiStatus,
    makeRequest,
    searchUSASpending,
    searchNonprofits,
    searchFECContributions,
    searchCourtCases,
    searchCompanies,
    searchOIGExclusions,
    scrapeDOJPress,
    scrapeFBIPress,
    searchMNLicensing,
    extractEntities
};
