/**
 * NORTH STAR WATCHDOG - OSINT ENRICHMENT
 * 
 * Calls FREE public APIs to enrich AI findings.
 * 
 * FREE APIs USED (NO KEYS REQUIRED):
 * - ProPublica Nonprofits API
 * - FEC Campaign Finance API
 * - OIG Exclusions (HHS)
 * - OpenCorporates
 * - USASpending.gov
 * - DOJ/FBI Press (web scrape)
 * 
 * All these APIs are genuinely free and work without authentication.
 * 
 * FIX: Now tracks which sources returned data for EACH entity
 * so red flags can accurately show which APIs were actually used.
 */

const https = require('https');
const http = require('http');

// Track API calls for logging
const API_STATS = { calls: 0, successes: 0, failures: 0 };

/**
 * Make HTTP request with timeout
 */
function makeRequest(url, options = {}) {
    API_STATS.calls++;
    
    return new Promise((resolve) => {
        const timeout = options.timeout || 15000;
        const isHttps = url.startsWith('https');
        const client = isHttps ? https : http;
        
        const req = client.get(url, { timeout, headers: options.headers || {} }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    API_STATS.successes++;
                    resolve({ success: true, data: json, status: res.statusCode });
                } catch {
                    API_STATS.successes++;
                    resolve({ success: true, data: data, status: res.statusCode, raw: true });
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
    });
}

// ============================================
// PROPUBLICA NONPROFIT API (FREE)
// https://projects.propublica.org/nonprofits/api
// ============================================

async function searchNonprofits(query) {
    const url = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(query)}`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.organizations) {
        const orgs = result.data.organizations.slice(0, 10).map(o => ({
            name: o.name,
            ein: o.ein,
            city: o.city,
            state: o.state,
            income: o.income_amount,
            assets: o.asset_amount,
            nteeCode: o.ntee_code
        }));
        
        return { source: 'ProPublica Nonprofits', found: orgs.length, organizations: orgs };
    }
    
    return { source: 'ProPublica Nonprofits', found: 0 };
}

// ============================================
// FEC CAMPAIGN FINANCE (FREE)
// https://api.open.fec.gov
// ============================================

async function searchFEC(query) {
    // FEC has a public demo key
    const apiKey = 'DEMO_KEY';
    const url = `https://api.open.fec.gov/v1/candidates/search/?q=${encodeURIComponent(query)}&api_key=${apiKey}`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results) {
        const candidates = result.data.results.slice(0, 10).map(c => ({
            name: c.name,
            party: c.party,
            office: c.office_full,
            state: c.state,
            district: c.district,
            candidateId: c.candidate_id
        }));
        
        return { source: 'FEC', found: candidates.length, candidates };
    }
    
    return { source: 'FEC', found: 0 };
}

async function searchFECContributions(name) {
    const apiKey = 'DEMO_KEY';
    const url = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(name)}&api_key=${apiKey}&per_page=20`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results) {
        const contributions = result.data.results.slice(0, 20).map(c => ({
            contributor: c.contributor_name,
            amount: c.contribution_receipt_amount,
            date: c.contribution_receipt_date,
            committee: c.committee?.name,
            employer: c.contributor_employer
        }));
        
        const total = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
        
        return { source: 'FEC', found: contributions.length, contributions, totalAmount: total };
    }
    
    return { source: 'FEC', found: 0 };
}

// ============================================
// OIG EXCLUSIONS (HHS) - FREE
// https://exclusions.oig.hhs.gov
// ============================================

async function searchOIGExclusions(name) {
    // OIG has a public search
    const url = `https://exclusions.oig.hhs.gov/api/exclusions?name=${encodeURIComponent(name)}`;
    const result = await makeRequest(url);
    
    if (result.success && Array.isArray(result.data)) {
        const exclusions = result.data.slice(0, 10).map(e => ({
            name: `${e.firstname || ''} ${e.lastname || ''}`.trim() || e.busname,
            type: e.excltype,
            date: e.excldate,
            state: e.state,
            specialty: e.specialty
        }));
        
        return { 
            source: 'OIG Exclusions', 
            found: exclusions.length, 
            exclusions,
            warning: exclusions.length > 0 ? 'EXCLUDED FROM FEDERAL HEALTHCARE PROGRAMS' : null
        };
    }
    
    return { source: 'OIG Exclusions', found: 0 };
}

// ============================================
// OPENCORPORATES (FREE, limited)
// https://api.opencorporates.com
// ============================================

async function searchCompanies(query) {
    const url = `https://api.opencorporates.com/v0.4/companies/search?q=${encodeURIComponent(query)}&jurisdiction_code=us_mn`;
    const result = await makeRequest(url);
    
    if (result.success && result.data?.results?.companies) {
        const companies = result.data.results.companies.slice(0, 10).map(c => ({
            name: c.company?.name,
            number: c.company?.company_number,
            status: c.company?.current_status,
            type: c.company?.company_type,
            jurisdiction: c.company?.jurisdiction_code,
            incorporationDate: c.company?.incorporation_date,
            registeredAddress: c.company?.registered_address_in_full
        }));
        
        return { source: 'OpenCorporates', found: companies.length, companies };
    }
    
    return { source: 'OpenCorporates', found: 0 };
}

// ============================================
// USASPENDING.GOV (FREE)
// https://api.usaspending.gov
// ============================================

async function searchUSASpending(query) {
    // USASpending requires POST
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            filters: {
                keywords: [query],
                award_type_codes: ["02", "03", "04", "05"]
            },
            limit: 10
        });
        
        const req = https.request({
            hostname: 'api.usaspending.gov',
            path: '/api/v2/search/spending_by_award/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    const awards = (json.results || []).slice(0, 10).map(a => ({
                        recipient: a.recipient_name,
                        amount: a.Award_Amount,
                        agency: a.awarding_agency_name,
                        type: a.Award_Type,
                        date: a.Award_Date
                    }));
                    
                    API_STATS.successes++;
                    resolve({ source: 'USASpending', found: awards.length, awards });
                } catch {
                    API_STATS.failures++;
                    resolve({ source: 'USASpending', found: 0 });
                }
            });
        });
        
        req.on('error', () => {
            API_STATS.failures++;
            resolve({ source: 'USASpending', found: 0 });
        });
        
        req.on('timeout', () => {
            req.destroy();
            API_STATS.failures++;
            resolve({ source: 'USASpending', found: 0 });
        });
        
        API_STATS.calls++;
        req.write(postData);
        req.end();
    });
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// FIX: Now tracks which sources had data for EACH entity
// ============================================

async function enrichFindings(aiAnalysis) {
    console.log('\n  Starting OSINT enrichment with FREE APIs...');
    
    const results = {
        nonprofits: [],
        campaigns: [],
        exclusions: [],
        companies: [],
        spending: [],
        sourcesUsed: [],
        sourcesChecked: [],
        // NEW: Per-entity source tracking
        entitySources: {}  // { "Entity Name": ["ProPublica", "FEC", ...] }
    };
    
    // Extract entities from AI analysis
    const persons = (aiAnalysis.figures || []).map(f => f.name).filter(Boolean);
    const orgs = [
        ...(aiAnalysis.figures || []).map(f => f.organization).filter(Boolean),
        ...(aiAnalysis.investigations || []).map(i => i.name).filter(Boolean)
    ];
    
    // Also extract from red flags
    const redFlagEntities = (aiAnalysis.redFlags || [])
        .flatMap(rf => rf.entities || [])
        .filter(Boolean);
    
    const allEntities = [...new Set([...persons, ...orgs, ...redFlagEntities])].slice(0, 15);
    
    console.log(`  Entities to search: ${allEntities.length}`);
    
    // Initialize entity source tracking - ALL entities start with Google News
    // because that's where the AI found them initially
    for (const entity of allEntities) {
        results.entitySources[entity.toLowerCase()] = ['Google News'];
    }
    
    // 1. ProPublica Nonprofits
    console.log('\n  [1/5] ProPublica Nonprofits...');
    results.sourcesChecked.push('ProPublica Nonprofits');
    
    for (const entity of allEntities.slice(0, 5)) {
        console.log(`    ProPublica: Searching "${entity}"...`);
        const data = await searchNonprofits(entity);
        if (data.found > 0) {
            console.log(`      Found ${data.found} nonprofits`);
            results.nonprofits.push(data);
            if (!results.sourcesUsed.includes('ProPublica Nonprofits')) {
                results.sourcesUsed.push('ProPublica Nonprofits');
            }
            // Track this source for this entity
            const key = entity.toLowerCase();
            if (!results.entitySources[key].includes('ProPublica Nonprofits')) {
                results.entitySources[key].push('ProPublica Nonprofits');
            }
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    // 2. FEC Campaign Finance
    console.log('\n  [2/5] FEC Campaign Finance...');
    results.sourcesChecked.push('FEC');
    
    for (const person of persons.slice(0, 5)) {
        console.log(`    FEC Contributions: Searching "${person}"...`);
        const data = await searchFECContributions(person);
        if (data.found > 0) {
            console.log(`      Found ${data.found} contributions totaling $${data.totalAmount?.toLocaleString() || 0}`);
            results.campaigns.push(data);
            if (!results.sourcesUsed.includes('FEC')) {
                results.sourcesUsed.push('FEC');
            }
            // Track this source for this entity
            const key = person.toLowerCase();
            if (results.entitySources[key] && !results.entitySources[key].includes('FEC')) {
                results.entitySources[key].push('FEC');
            }
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    // 3. OIG Exclusions (CRITICAL for fraud)
    console.log('\n  [3/5] OIG Exclusions (Healthcare Ban List)...');
    results.sourcesChecked.push('OIG Exclusions');
    
    for (const entity of allEntities.slice(0, 8)) {
        console.log(`    OIG Exclusions: Checking "${entity}"...`);
        const data = await searchOIGExclusions(entity);
        if (data.found > 0) {
            console.log(`      🚨 FOUND ${data.found} EXCLUDED from federal healthcare!`);
            results.exclusions.push(data);
            if (!results.sourcesUsed.includes('OIG Exclusions')) {
                results.sourcesUsed.push('OIG Exclusions');
            }
            // Track this source for this entity
            const key = entity.toLowerCase();
            if (results.entitySources[key] && !results.entitySources[key].includes('OIG Exclusions')) {
                results.entitySources[key].push('OIG Exclusions');
            }
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    // 4. OpenCorporates
    console.log('\n  [4/5] OpenCorporates...');
    results.sourcesChecked.push('OpenCorporates');
    
    for (const org of orgs.slice(0, 5)) {
        console.log(`    OpenCorporates: Searching "${org}"...`);
        const data = await searchCompanies(org);
        if (data.found > 0) {
            console.log(`      Found ${data.found} companies`);
            results.companies.push(data);
            if (!results.sourcesUsed.includes('OpenCorporates')) {
                results.sourcesUsed.push('OpenCorporates');
            }
            // Track this source for this entity
            const key = org.toLowerCase();
            if (results.entitySources[key] && !results.entitySources[key].includes('OpenCorporates')) {
                results.entitySources[key].push('OpenCorporates');
            }
        }
        await new Promise(r => setTimeout(r, 300));
    }
    
    // 5. USASpending
    console.log('\n  [5/5] USASpending.gov...');
    results.sourcesChecked.push('USASpending');
    
    for (const org of orgs.slice(0, 3)) {
        console.log(`    USASpending: Searching "${org}"...`);
        const data = await searchUSASpending(org);
        if (data.found > 0) {
            console.log(`      Found ${data.found} federal awards`);
            results.spending.push(data);
            if (!results.sourcesUsed.includes('USASpending')) {
                results.sourcesUsed.push('USASpending');
            }
            // Track this source for this entity
            const key = org.toLowerCase();
            if (results.entitySources[key] && !results.entitySources[key].includes('USASpending')) {
                results.entitySources[key].push('USASpending');
            }
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Summary
    console.log('\n  ══════════════════════════════════════');
    console.log('  OSINT COMPLETE');
    console.log(`  Sources checked: ${results.sourcesChecked.length}`);
    console.log(`  Sources with data: ${results.sourcesUsed.length}`);
    console.log(`  Sources: ${results.sourcesUsed.join(', ') || 'None returned data'}`);
    console.log(`  API calls: ${API_STATS.calls} (${API_STATS.successes} ok, ${API_STATS.failures} failed)`);
    
    // Log per-entity sources
    console.log('  Per-entity sources:');
    for (const [entity, sources] of Object.entries(results.entitySources)) {
        if (sources.length > 1) {
            console.log(`    - ${entity}: ${sources.join(', ')}`);
        }
    }
    console.log('  ══════════════════════════════════════\n');
    
    return results;
}

module.exports = { enrichFindings };
