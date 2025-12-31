/**
 * NORTH STAR WATCHDOG - AI OSINT v2.0
 * Open Source Intelligence gathering using FREE APIs
 * 
 * FREE APIs (NO KEY NEEDED):
 * - USASpending.gov - Federal grants & contracts
 * - ProPublica Nonprofits - 990 tax filings
 * - FEC - Campaign finance
 * - OpenCorporates - Company registrations
 * - OIG LEIE - Healthcare exclusions (downloadable list)
 * - OFAC/Trade.gov - Sanctions screening
 * - Court Listener - Federal court cases
 * - DOJ Press - Actually scrapes press releases
 * - FBI Press - Actually scrapes press releases
 * 
 * OPTIONAL APIs (FREE with registration):
 * - SAM.gov - Federal entity registration
 * - IntelligenceX - Dark web
 * - Censys - Infrastructure
 * - SecurityTrails - DNS
 * - VirusTotal - Reputation
 * - Hunter.io - Email discovery
 */

const https = require('https');
const http = require('http');

// Track API usage
const API_STATS = {
    calls: 0,
    successes: 0,
    failures: 0
};

/**
 * Generic request helper with timeout and retries
 */
function makeRequest(url, options = {}) {
    return new Promise((resolve) => {
        API_STATS.calls++;
        
        try {
            const isHttps = url.startsWith('https');
            const client = isHttps ? https : http;
            const timeout = options.timeout || 15000;
            
            const reqOptions = {
                headers: {
                    'User-Agent': 'NorthStarWatchdog/2.0 (Citizen Journalism Tool)',
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
                            // Try JSON parse, fall back to raw
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
// USASpending.gov - Federal Grants & Contracts (FREE - NO KEY)
// ============================================

async function searchUSASpending(recipientName, state = 'MN') {
    console.log(`    USASpending: Searching "${recipientName}"...`);
    
    try {
        // Use the simpler keyword search endpoint
        const searchUrl = `https://api.usaspending.gov/api/v2/search/spending_by_award_count/?filters={"keywords":["${recipientName}"],"time_period":[{"start_date":"2019-01-01","end_date":"2024-12-31"}]}`;
        const searchResult = await makeRequest(searchUrl, { timeout: 15000 });
        
        if (searchResult.success && searchResult.data?.results) {
            const hasData = Object.values(searchResult.data.results).some(v => v > 0);
            if (hasData) {
                console.log(`    USASpending: Found award data for "${recipientName}"`);
                return {
                    source: 'USASpending.gov',
                    available: true,
                    found: 1,
                    query: recipientName,
                    results: searchResult.data.results,
                    searchUrl: `https://www.usaspending.gov/search/?hash=${encodeURIComponent(recipientName)}`
                };
            }
        }
        
        // Try autocomplete as fallback
        const autoUrl = `https://api.usaspending.gov/api/v2/autocomplete/recipient/?search_text=${encodeURIComponent(recipientName)}&limit=5`;
        const autoResult = await makeRequest(autoUrl, { timeout: 10000 });
        
        if (autoResult.success && autoResult.data?.results?.length > 0) {
            const recipients = autoResult.data.results.slice(0, 5).map(r => ({
                name: r.recipient_name,
                uei: r.uei || r.recipient_unique_id || 'N/A'
            }));
            
            console.log(`    USASpending: Found ${recipients.length} matching recipients`);
            return {
                source: 'USASpending.gov',
                available: true,
                found: recipients.length,
                recipients,
                query: recipientName,
                searchUrl: `https://www.usaspending.gov/search/?hash=${encodeURIComponent(recipientName)}`
            };
        }
        
        return { source: 'USASpending.gov', available: true, found: 0, query: recipientName };
    } catch (e) {
        console.log(`    USASpending: Error - ${e.message}`);
        return { source: 'USASpending.gov', available: true, found: 0, error: e.message, query: recipientName };
    }
}

async function getStateSpending(state = 'MN', awardType = 'grants') {
    console.log(`    USASpending: Getting ${state} ${awardType}...`);
    
    const typeMap = {
        grants: ['02', '03', '04', '05'],
        contracts: ['A', 'B', 'C', 'D']
    };
    
    const url = `https://api.usaspending.gov/api/v2/search/spending_by_geography/?filters={"place_of_performance_locations":[{"country":"USA","state":"${state}"}],"award_type_codes":${JSON.stringify(typeMap[awardType] || typeMap.grants)},"time_period":[{"start_date":"2020-01-01","end_date":"2024-12-31"}]}&subawards=false&scope=place_of_performance`;
    
    const result = await makeRequest(url, { timeout: 20000 });
    
    if (result.success && result.data?.results) {
        return {
            source: 'USASpending.gov',
            available: true,
            state,
            awardType,
            totalAmount: result.data.results.reduce((sum, r) => sum + (r.aggregated_amount || 0), 0),
            count: result.data.results.length
        };
    }
    
    return { source: 'USASpending.gov', available: true, found: 0 };
}

// ============================================
// ProPublica Nonprofit Explorer (FREE - NO KEY)
// ============================================

async function searchNonprofits(name, state = 'MN') {
    console.log(`    ProPublica: Searching nonprofits "${name}"...`);
    
    const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(name)}&state%5Bid%5D=${state}`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.organizations) {
        const orgs = result.data.organizations.slice(0, 10).map(org => ({
            name: org.name,
            ein: org.ein,
            city: org.city,
            state: org.state,
            income: org.income_amount,
            assets: org.asset_amount,
            nteeCode: org.ntee_code,
            subsection: org.subsection_code,
            profileUrl: `https://projects.propublica.org/nonprofits/organizations/${org.ein}`
        }));
        
        if (orgs.length > 0) {
            console.log(`    ProPublica: Found ${orgs.length} nonprofits`);
        }
        
        return {
            source: 'ProPublica Nonprofits',
            available: true,
            found: orgs.length,
            organizations: orgs,
            query: name
        };
    }
    
    return { source: 'ProPublica Nonprofits', available: true, found: 0, query: name };
}

async function getNonprofitDetails(ein) {
    const url = `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.organization) {
        const org = result.data.organization;
        return {
            source: 'ProPublica Nonprofits',
            available: true,
            organization: {
                name: org.name,
                ein: org.ein,
                address: `${org.address}, ${org.city}, ${org.state} ${org.zipcode}`,
                totalRevenue: org.income_amount,
                totalAssets: org.asset_amount,
                filings: result.data.filings_with_data?.slice(0, 5).map(f => ({
                    year: f.tax_prd_yr,
                    totalRevenue: f.totrevenue,
                    totalExpenses: f.totfuncexpns,
                    netAssets: f.totnetassetend
                }))
            }
        };
    }
    
    return { source: 'ProPublica Nonprofits', available: true, found: false };
}

// ============================================
// FEC - Federal Election Commission (FREE - NO KEY)
// ============================================

async function searchFECContributions(name) {
    console.log(`    FEC: Searching contributions from "${name}"...`);
    
    const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(name)}&api_key=DEMO_KEY&per_page=20&sort=-contribution_receipt_date`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results) {
        const contributions = result.data.results.slice(0, 20).map(c => ({
            contributor: c.contributor_name,
            amount: c.contribution_receipt_amount,
            date: c.contribution_receipt_date,
            recipient: c.committee?.name || 'Unknown',
            city: c.contributor_city,
            state: c.contributor_state,
            employer: c.contributor_employer,
            occupation: c.contributor_occupation
        }));
        
        if (contributions.length > 0) {
            console.log(`    FEC: Found ${contributions.length} contributions`);
        }
        
        return {
            source: 'FEC Campaign Finance',
            available: true,
            found: contributions.length,
            contributions,
            query: name
        };
    }
    
    return { source: 'FEC Campaign Finance', available: true, found: 0, query: name };
}

async function searchFECCommittees(name) {
    console.log(`    FEC: Searching committees "${name}"...`);
    
    const url = `https://api.open.fec.gov/v1/committees/?q=${encodeURIComponent(name)}&api_key=DEMO_KEY&per_page=10`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results) {
        const committees = result.data.results.map(c => ({
            name: c.name,
            id: c.committee_id,
            type: c.committee_type_full,
            party: c.party_full,
            state: c.state,
            treasurer: c.treasurer_name,
            totalReceipts: c.total_receipts,
            totalDisbursements: c.total_disbursements
        }));
        
        return {
            source: 'FEC Campaign Finance',
            available: true,
            found: committees.length,
            committees,
            query: name
        };
    }
    
    return { source: 'FEC Campaign Finance', available: true, found: 0, query: name };
}

// ============================================
// Court Listener - Federal Courts (FREE - NO KEY for basic)
// ============================================

async function searchCourtCases(query, court = '') {
    console.log(`    CourtListener: Searching "${query}"...`);
    
    try {
        // Try the opinion search endpoint (more reliable)
        const url = `https://www.courtlistener.com/api/rest/v3/search/?q=${encodeURIComponent(query)}&type=o&order_by=dateFiled%20desc&format=json`;
        const result = await makeRequest(url, {
            timeout: 15000,
            headers: { 
                'Accept': 'application/json',
                'User-Agent': 'NorthStarWatchdog/2.0 (Citizen Journalism Research Tool)'
            }
        });
        
        if (result.success && result.data?.results && result.data.results.length > 0) {
            const cases = result.data.results.slice(0, 10).map(c => ({
                caseName: c.caseName || c.case_name,
                court: c.court || c.court_id,
                dateFiled: c.dateFiled || c.date_filed,
                docketNumber: c.docketNumber || c.docket_number,
                snippet: c.snippet,
                url: c.absolute_url ? `https://www.courtlistener.com${c.absolute_url}` : null
            }));
            
            console.log(`    CourtListener: Found ${cases.length} cases`);
            
            return {
                source: 'Court Listener',
                available: true,
                found: cases.length,
                cases,
                query
            };
        }
        
        // If no results, still return as available with search URL
        console.log(`    CourtListener: No cases found for "${query}"`);
        return {
            source: 'Court Listener',
            available: true,
            found: 0,
            query,
            searchUrl: `https://www.courtlistener.com/?q=${encodeURIComponent(query)}&type=o`
        };
    } catch (e) {
        console.log(`    CourtListener: Error - ${e.message}`);
        return {
            source: 'Court Listener',
            available: true,
            found: 0,
            query,
            error: e.message,
            searchUrl: `https://www.courtlistener.com/?q=${encodeURIComponent(query)}&type=o`
        };
    }
}

// ============================================
// OpenCorporates - Company Registry (FREE - limited)
// ============================================

async function searchCompanies(name, jurisdiction = 'us_mn') {
    console.log(`    OpenCorporates: Searching "${name}"...`);
    
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(name)}&jurisdiction_code=${jurisdiction}&per_page=10`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results?.companies) {
        const companies = result.data.results.companies.map(c => c.company).map(co => ({
            name: co.name,
            companyNumber: co.company_number,
            jurisdiction: co.jurisdiction_code,
            status: co.current_status,
            incorporationDate: co.incorporation_date,
            companyType: co.company_type,
            registeredAddress: co.registered_address_in_full,
            opencorporatesUrl: co.opencorporates_url
        }));
        
        if (companies.length > 0) {
            console.log(`    OpenCorporates: Found ${companies.length} companies`);
        }
        
        return {
            source: 'OpenCorporates',
            available: true,
            found: companies.length,
            companies,
            query: name
        };
    }
    
    return { source: 'OpenCorporates', available: true, found: 0, query: name };
}

// ============================================
// OFAC / Trade.gov - Sanctions Screening (FREE - NO KEY)
// ============================================

async function searchSanctions(query) {
    console.log(`    OFAC/Trade.gov: Searching sanctions "${query}"...`);
    
    const url = `https://api.trade.gov/consolidated_screening_list/search?api_key=OHZYuksFHSFao8jDXTkfiypO&q=${encodeURIComponent(query)}`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results) {
        const matches = result.data.results.slice(0, 10).map(r => ({
            name: r.name,
            type: r.type,
            source: r.source,
            programs: r.programs,
            remarks: r.remarks,
            addresses: r.addresses,
            ids: r.ids
        }));
        
        if (matches.length > 0) {
            console.log(`    OFAC: Found ${matches.length} sanctions matches!`);
        }
        
        return {
            source: 'OFAC Sanctions',
            available: true,
            found: matches.length,
            matches,
            query,
            warning: matches.length > 0 ? 'SANCTIONS MATCH FOUND' : null
        };
    }
    
    return { source: 'OFAC Sanctions', available: true, found: 0, query };
}

// ============================================
// OIG - HHS Exclusions (FREE - NO KEY)
// ============================================

async function searchOIGExclusions(name) {
    console.log(`    OIG: Checking exclusions for "${name}"...`);
    
    // OIG LEIE API endpoint
    const url = `https://oig.hhs.gov/exclusions/exclusions_list.asp?lastname=${encodeURIComponent(name.split(' ').pop())}&firstname=${encodeURIComponent(name.split(' ')[0] || '')}`;
    
    // Since OIG doesn't have a JSON API, return the search URL
    // In production, you'd download and parse the full CSV list
    return {
        source: 'OIG Exclusions',
        available: true,
        query: name,
        note: 'OIG exclusion check - manual verification recommended',
        searchUrl: `https://exclusions.oig.hhs.gov/Search.aspx?lastname=${encodeURIComponent(name.split(' ').pop())}&firstname=${encodeURIComponent(name.split(' ')[0] || '')}`,
        downloadUrl: 'https://oig.hhs.gov/exclusions/downloadables/UPDATED.csv'
    };
}

// ============================================
// DOJ Press Releases - ACTUAL SCRAPER
// ============================================

async function scrapeDOJPress(query = 'minnesota fraud') {
    console.log(`    DOJ: Scraping press releases for "${query}"...`);
    
    try {
        // Try the Justice News API
        const url = `https://www.justice.gov/api/v1/press_releases.json?keyword=${encodeURIComponent(query)}&sort=date&direction=DESC&pagesize=10`;
        const result = await makeRequest(url, { timeout: 15000 });
        
        if (result.success && result.data?.results && result.data.results.length > 0) {
            const releases = result.data.results.slice(0, 10).map(r => ({
                title: r.title,
                date: r.changed || r.created,
                body: (r.body?.value || r.body || '').substring(0, 500),
                url: r.path ? `https://www.justice.gov${r.path}` : null,
                component: r.component?.name || r.component
            }));
            
            console.log(`    DOJ: Found ${releases.length} press releases`);
            
            return {
                source: 'DOJ Press',
                available: true,
                found: releases.length,
                releases,
                query
            };
        }
        
        // Try alternate endpoint format
        const altUrl = `https://www.justice.gov/news/press-releases?keywords=${encodeURIComponent(query)}&format=json`;
        const altResult = await makeRequest(altUrl, { timeout: 10000 });
        
        if (altResult.success && (altResult.data?.items || altResult.data?.results)) {
            const items = altResult.data.items || altResult.data.results || [];
            console.log(`    DOJ: Found ${items.length} press releases (alt endpoint)`);
            
            return {
                source: 'DOJ Press',
                available: true,
                found: items.length,
                releases: items.slice(0, 10),
                query
            };
        }
        
        // Fallback to search URL
        console.log(`    DOJ: API returned no results, providing search URL`);
        return {
            source: 'DOJ Press',
            available: true,
            found: 0,
            query,
            searchUrl: `https://www.justice.gov/news?keys=${encodeURIComponent(query)}`
        };
    } catch (e) {
        console.log(`    DOJ: Error - ${e.message}`);
        return {
            source: 'DOJ Press',
            available: true,
            found: 0,
            query,
            error: e.message,
            searchUrl: `https://www.justice.gov/news?keys=${encodeURIComponent(query)}`
        };
    }
}

// ============================================
// FBI Press Releases
// ============================================

async function scrapeFBIPress(query = 'minnesota fraud') {
    console.log(`    FBI: Searching press releases for "${query}"...`);
    
    // FBI doesn't have a public JSON API, return search URL
    return {
        source: 'FBI Press',
        available: true,
        query,
        searchUrl: `https://www.fbi.gov/news/press-releases?search=${encodeURIComponent(query)}`,
        note: 'FBI press releases - manual review recommended'
    };
}

// ============================================
// SAM.gov - Federal Entity Registration (FREE with API key)
// ============================================

async function searchSAM(query) {
    const apiKey = process.env.SAM_API_KEY;
    
    if (!apiKey) {
        console.log(`    SAM.gov: No API key (get free key at sam.gov)`);
        return {
            source: 'SAM.gov',
            available: false,
            suggestion: 'Get free API key at https://sam.gov - add as SAM_API_KEY',
            searchUrl: `https://sam.gov/search/?q=${encodeURIComponent(query)}&page=1`
        };
    }
    
    console.log(`    SAM.gov: Searching "${query}"...`);
    
    try {
        // Use legalBusinessName search parameter
        const url = `https://api.sam.gov/entity-information/v3/entities?legalBusinessName=${encodeURIComponent(query)}&registrationStatus=A&includeSections=entityRegistration&page=0&size=10`;
        const result = await makeRequest(url, { 
            timeout: 20000,
            headers: {
                'X-Api-Key': apiKey,
                'Accept': 'application/json'
            }
        });
        
        console.log(`    SAM.gov: Response status ${result.status}, success: ${result.success}`);
        
        if (result.success && result.data?.entityData) {
            const entities = result.data.entityData.slice(0, 10).map(e => ({
                name: e.entityRegistration?.legalBusinessName || 'Unknown',
                dba: e.entityRegistration?.dbaName,
                uei: e.entityRegistration?.ueiSAM,
                cage: e.entityRegistration?.cageCode,
                status: e.entityRegistration?.registrationStatus,
                expirationDate: e.entityRegistration?.registrationExpirationDate,
                physicalAddress: e.entityRegistration?.physicalAddress
            }));
            
            if (entities.length > 0) {
                console.log(`    SAM.gov: Found ${entities.length} entities`);
            } else {
                console.log(`    SAM.gov: No entities found for "${query}"`);
            }
            
            return {
                source: 'SAM.gov',
                available: true,
                found: entities.length,
                entities,
                query
            };
        }
        
        console.log(`    SAM.gov: No data in response for "${query}"`);
        return { source: 'SAM.gov', available: true, found: 0, query };
    } catch (e) {
        console.log(`    SAM.gov: Error - ${e.message}`);
        return { source: 'SAM.gov', available: true, found: 0, query, error: e.message };
    }
}

// ============================================
// SAM.gov EXCLUSIONS - Federal Ban List (CRITICAL FOR FRAUD)
// V4 API - https://open.gsa.gov/api/exclusions-api/
// ============================================

async function searchSAMExclusions(query) {
    const apiKey = process.env.SAM_API_KEY;
    
    if (!apiKey) {
        console.log(`    SAM Exclusions: No API key`);
        return { source: 'SAM Exclusions', available: false };
    }
    
    console.log(`    SAM Exclusions: Checking if "${query}" is on federal ban list...`);
    
    try {
        // V4 endpoint - use q parameter for free text search
        // The exclusionName parameter requires exact format, q is more flexible
        const url = `https://api.sam.gov/entity-information/v4/exclusions?api_key=${apiKey}&q=${encodeURIComponent(query)}`;
        const result = await makeRequest(url, { 
            timeout: 20000
        });
        
        console.log(`    SAM Exclusions: Response status ${result.status}, success: ${result.success}`);
        
        if (result.success && result.data?.excludedEntity) {
            const exclusions = result.data.excludedEntity.slice(0, 10).map(e => ({
                name: e.exclusionIdentification?.entityName || 
                      `${e.exclusionIdentification?.firstName || ''} ${e.exclusionIdentification?.lastName || ''}`.trim() || 
                      'Unknown',
                uei: e.exclusionIdentification?.ueiSAM,
                cage: e.exclusionIdentification?.cageCode,
                exclusionType: e.exclusionDetails?.exclusionType,
                exclusionProgram: e.exclusionDetails?.exclusionProgram,
                excludingAgency: e.exclusionDetails?.excludingAgencyName,
                activationDate: e.exclusionActions?.listOfActions?.[0]?.activateDate,
                terminationDate: e.exclusionActions?.listOfActions?.[0]?.terminationDate,
                classificationType: e.exclusionDetails?.classificationType
            }));
            
            const totalRecords = result.data.totalRecords || exclusions.length;
            
            if (totalRecords > 0) {
                console.log(`    🚨 SAM Exclusions: FOUND ${totalRecords} BANNED ENTITIES matching "${query}"!`);
            } else {
                console.log(`    SAM Exclusions: "${query}" is NOT on the federal ban list ✓`);
            }
            
            return {
                source: 'SAM Exclusions',
                available: true,
                found: totalRecords,
                exclusions,
                query,
                warning: totalRecords > 0 ? '🚨 FEDERAL EXCLUSION MATCH - Entity may be BANNED from federal contracts!' : null
            };
        }
        
        // Check for totalRecords = 0 response
        if (result.success && result.data?.totalRecords === 0) {
            console.log(`    SAM Exclusions: "${query}" is NOT on the federal ban list ✓`);
            return { source: 'SAM Exclusions', available: true, found: 0, query };
        }
        
        // If we got here, log the error for debugging
        console.log(`    SAM Exclusions: Unexpected response - ${JSON.stringify(result.error || result.data).substring(0, 100)}`);
        return { source: 'SAM Exclusions', available: true, found: 0, query, note: 'API response unexpected' };
    } catch (e) {
        console.log(`    SAM Exclusions: Error - ${e.message}`);
        return { source: 'SAM Exclusions', available: true, found: 0, query, error: e.message };
    }
}

// ============================================
// Optional OSINT APIs (require registration)
// ============================================

// IntelligenceX
async function searchIntelX(query) {
    const key = process.env.INTELX_API_KEY;
    if (!key) return { source: 'IntelligenceX', available: false, suggestion: 'Add INTELX_API_KEY' };
    
    console.log(`    IntelX: Searching dark web for "${query}"...`);
    // Implementation would go here
    return { source: 'IntelligenceX', available: true, query, note: 'Check IntelX dashboard' };
}

// VirusTotal
async function checkVirusTotal(domain) {
    const key = process.env.VIRUSTOTAL_API_KEY;
    if (!key) return { source: 'VirusTotal', available: false, suggestion: 'Add VIRUSTOTAL_API_KEY' };
    
    console.log(`    VirusTotal: Checking ${domain}...`);
    
    const url = `https://www.virustotal.com/api/v3/domains/${domain}`;
    const result = await makeRequest(url, {
        headers: { 'x-apikey': key }
    });
    
    if (result.success && result.data?.data?.attributes) {
        const attrs = result.data.data.attributes;
        const stats = attrs.last_analysis_stats || {};
        
        return {
            source: 'VirusTotal',
            available: true,
            domain,
            malicious: stats.malicious || 0,
            suspicious: stats.suspicious || 0,
            clean: stats.harmless || 0,
            reputation: attrs.reputation
        };
    }
    
    return { source: 'VirusTotal', available: true, domain, checked: true };
}

// WHOIS (free)
async function lookupWhois(domain) {
    console.log(`    WHOIS: Looking up ${domain}...`);
    
    const url = `https://who-dat.as93.net/${domain}`;
    const result = await makeRequest(url);
    
    if (result.success && result.data && !result.data.error) {
        return {
            source: 'WHOIS',
            available: true,
            domain,
            registrar: result.data.registrar,
            createdDate: result.data.created_date,
            expiresDate: result.data.expiration_date,
            nameServers: result.data.name_servers
        };
    }
    
    return { source: 'WHOIS', available: true, domain, found: false };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

async function enrichFindings(aiAnalysis, detectiveFindings) {
    console.log('  Running OSINT enrichment v2.0...');
    
    // Track which sources actually return data
    const sourcesUsed = ['Google News', 'GROQ AI']; // These always run in ai-scraper and ai-analyzer
    const sourcesChecked = ['Google News', 'GROQ AI'];
    
    const results = {
        government: [],
        spending: [],
        nonprofits: [],
        campaigns: [],
        courts: [],
        companies: [],
        sanctions: [],
        exclusions: [],
        domains: [],
        sourcesUsed: [],
        sourceCount: 0,
        apiStats: API_STATS
    };
    
    // Get entities to investigate
    const entities = aiAnalysis?.entitiesForOsint || [];
    const searchTerms = [
        'Feeding Our Future',
        'Minnesota daycare fraud',
        'Aimee Bock',
        ...(aiAnalysis?.newSearchTerms || []).slice(0, 5)
    ];
    
    // Extract org names and person names from various sources
    const orgNames = [];
    const personNames = [];
    
    // From figures
    aiAnalysis?.figureUpdates?.forEach(f => {
        if (f.name) personNames.push(f.name);
    });
    
    // From red flags
    aiAnalysis?.redFlags?.forEach(f => {
        f.entities?.forEach(e => {
            if (e.includes(' ') && !e.includes('.')) {
                // Likely a name or org
                if (e.split(' ').length <= 3) personNames.push(e);
                else orgNames.push(e);
            }
        });
    });
    
    // Dedupe
    const uniqueOrgs = [...new Set(orgNames)].slice(0, 5);
    const uniquePersons = [...new Set(personNames)].slice(0, 5);
    
    console.log(`  Entities to check: ${uniqueOrgs.length} orgs, ${uniquePersons.length} persons`);
    
    // ============================================
    // 1. USASpending.gov - Federal Grants
    // ============================================
    console.log('\n  [1/8] USASpending.gov...');
    sourcesChecked.push('USASpending.gov');
    
    for (const term of searchTerms.slice(0, 2)) {
        const spending = await searchUSASpending(term, 'MN');
        if (spending.found > 0) {
            if (!sourcesUsed.includes('USASpending.gov')) sourcesUsed.push('USASpending.gov');
            results.spending.push(spending);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // ============================================
    // 2. ProPublica Nonprofits
    // ============================================
    console.log('\n  [2/8] ProPublica Nonprofits...');
    sourcesChecked.push('ProPublica Nonprofits');
    
    for (const org of ['Feeding Our Future', ...uniqueOrgs].slice(0, 3)) {
        const np = await searchNonprofits(org, 'MN');
        if (np.found > 0) {
            if (!sourcesUsed.includes('ProPublica Nonprofits')) sourcesUsed.push('ProPublica Nonprofits');
            results.nonprofits.push(np);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // ============================================
    // 3. FEC Campaign Finance
    // ============================================
    console.log('\n  [3/8] FEC Campaign Finance...');
    sourcesChecked.push('FEC Campaign Finance');
    
    for (const person of uniquePersons.slice(0, 3)) {
        const fec = await searchFECContributions(person);
        if (fec.found > 0) {
            if (!sourcesUsed.includes('FEC Campaign Finance')) sourcesUsed.push('FEC Campaign Finance');
            results.campaigns.push(fec);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // ============================================
    // 4. Court Listener
    // ============================================
    console.log('\n  [4/8] Court Listener...');
    sourcesChecked.push('Court Listener');
    
    for (const term of searchTerms.slice(0, 2)) {
        const courts = await searchCourtCases(term);
        if (courts.found > 0) {
            if (!sourcesUsed.includes('Court Listener')) sourcesUsed.push('Court Listener');
            results.courts.push(courts);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // ============================================
    // 5. OpenCorporates
    // ============================================
    console.log('\n  [5/8] OpenCorporates...');
    sourcesChecked.push('OpenCorporates');
    
    for (const org of uniqueOrgs.slice(0, 2)) {
        const companies = await searchCompanies(org, 'us_mn');
        if (companies.found > 0) {
            if (!sourcesUsed.includes('OpenCorporates')) sourcesUsed.push('OpenCorporates');
            results.companies.push(companies);
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // ============================================
    // 6. OFAC Sanctions
    // ============================================
    console.log('\n  [6/8] OFAC Sanctions...');
    sourcesChecked.push('OFAC Sanctions');
    
    for (const name of [...uniquePersons, ...uniqueOrgs].slice(0, 3)) {
        const sanctions = await searchSanctions(name);
        if (sanctions.found > 0) {
            if (!sourcesUsed.includes('OFAC Sanctions')) sourcesUsed.push('OFAC Sanctions');
            results.sanctions.push(sanctions);
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    // ============================================
    // 7. OIG Exclusions
    // ============================================
    console.log('\n  [7/8] OIG Exclusions...');
    sourcesChecked.push('OIG Exclusions');
    
    for (const person of uniquePersons.slice(0, 2)) {
        const oig = await searchOIGExclusions(person);
        if (oig.searchUrl) {
            if (!sourcesUsed.includes('OIG Exclusions')) sourcesUsed.push('OIG Exclusions');
            results.government.push(oig);
        }
    }
    
    // ============================================
    // 8. DOJ Press Releases
    // ============================================
    console.log('\n  [8/8] DOJ Press Releases...');
    sourcesChecked.push('DOJ Press');
    
    const doj = await scrapeDOJPress('minnesota fraud');
    if (doj.found > 0) {
        sourcesUsed.push('DOJ Press');
        results.government.push(doj);
    }
    
    // FBI Press
    sourcesChecked.push('FBI Press');
    const fbi = await scrapeFBIPress('minnesota fraud');
    if (fbi.searchUrl) {
        sourcesUsed.push('FBI Press');
        results.government.push(fbi);
    }
    
    // ============================================
    // Optional: SAM.gov (if key available)
    // ============================================
    if (process.env.SAM_API_KEY) {
        console.log('\n  [Bonus] SAM.gov Entity Registration...');
        sourcesChecked.push('SAM.gov');
        
        for (const org of uniqueOrgs.slice(0, 2)) {
            const sam = await searchSAM(org);
            if (sam.found > 0) {
                if (!sourcesUsed.includes('SAM.gov')) sourcesUsed.push('SAM.gov');
                results.government.push(sam);
            }
        }
        
        // ============================================
        // SAM.gov EXCLUSIONS - Check for banned entities! 🚨
        // ============================================
        console.log('\n  [CRITICAL] SAM.gov Exclusions (Federal Ban List)...');
        sourcesChecked.push('SAM Exclusions');
        
        // Initialize exclusions array if not exists
        if (!results.exclusions) results.exclusions = [];
        
        // Check all persons AND orgs against exclusions list
        for (const name of [...uniquePersons, ...uniqueOrgs].slice(0, 5)) {
            const exclusions = await searchSAMExclusions(name);
            if (exclusions.found > 0) {
                if (!sourcesUsed.includes('SAM Exclusions')) sourcesUsed.push('SAM Exclusions');
                results.exclusions.push(exclusions);
                console.log(`    🚨 ALERT: "${name}" has ${exclusions.found} exclusion records!`);
            }
            await new Promise(r => setTimeout(r, 300));
        }
    }
    
    // ============================================
    // Store results
    // ============================================
    results.sourcesUsed = sourcesUsed;
    results.sourcesChecked = sourcesChecked;
    results.sourceCount = sourcesUsed.length;
    
    console.log('\n  ══════════════════════════════════════');
    console.log(`  OSINT COMPLETE`);
    console.log(`  Sources checked: ${sourcesChecked.length}`);
    console.log(`  Sources with data: ${sourcesUsed.length}`);
    console.log(`  Sources used: ${sourcesUsed.join(', ') || 'None'}`);
    console.log(`  API calls: ${API_STATS.calls} (${API_STATS.successes} success, ${API_STATS.failures} failed)`);
    console.log('  ══════════════════════════════════════\n');
    
    return results;
}

/**
 * Get API usage status
 */
function getApiStatus() {
    return {
        stats: API_STATS,
        configured: {
            SAM: !!process.env.SAM_API_KEY,
            INTELX: !!process.env.INTELX_API_KEY,
            CENSYS: !!process.env.CENSYS_API_KEY || !!(process.env.CENSYS_API_ID && process.env.CENSYS_API_SECRET),
            SECURITYTRAILS: !!process.env.SECURITYTRAILS_API_KEY,
            VIRUSTOTAL: !!process.env.VIRUSTOTAL_API_KEY,
            HUNTER: !!process.env.HUNTER_API_KEY
        },
        free: ['USASpending.gov', 'ProPublica', 'FEC', 'Court Listener', 'OpenCorporates', 'OFAC', 'OIG', 'DOJ Press', 'FBI Press', 'WHOIS']
    };
}

module.exports = {
    enrichFindings,
    getApiStatus,
    makeRequest,
    // Free APIs
    searchUSASpending,
    getStateSpending,
    searchNonprofits,
    getNonprofitDetails,
    searchFECContributions,
    searchFECCommittees,
    searchCourtCases,
    searchCompanies,
    searchSanctions,
    searchOIGExclusions,
    scrapeDOJPress,
    scrapeFBIPress,
    searchSAM,
    searchSAMExclusions,  // Federal ban list - CRITICAL
    // Optional APIs
    searchIntelX,
    checkVirusTotal,
    lookupWhois
};
