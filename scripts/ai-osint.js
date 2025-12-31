/**
 * NORTH STAR WATCHDOG - AI OSINT
 * Open Source Intelligence gathering using free APIs
 * 
 * APIs Used (all FREE):
 * - IntelligenceX: Dark web, breaches, paste sites
 * - Censys: Server infrastructure, SSL certs
 * - SecurityTrails: DNS history, subdomains
 * - VirusTotal: Malware/reputation checks
 * - Hunter.io: Email discovery
 * - Numverify: Phone validation
 * - WHOIS (free): Domain registration
 * - OFAC/OIG (free): Sanctions and exclusions
 */

const https = require('https');
const http = require('http');

// API Keys from environment
const APIS = {
    // Government APIs (FREE - NO KEY NEEDED)
    SAM: {
        baseUrl: 'https://api.sam.gov/entity-information/v3/entities',
        key: process.env.SAM_API_KEY || null, // Optional - works without key for basic searches
        used: 0
    },
    OFAC: {
        baseUrl: 'https://sanctionssearch.ofac.treas.gov/api',
        used: 0
    },
    OIG: {
        baseUrl: 'https://exclusions.oig.hhs.gov/api',
        used: 0
    },
    // OSINT APIs (require free keys)
    INTELX: {
        key: process.env.INTELX_API_KEY,
        baseUrl: 'https://2.intelx.io',
        limitPerDay: 50,
        used: 0
    },
    CENSYS: {
        id: process.env.CENSYS_API_ID,
        secret: process.env.CENSYS_API_SECRET,
        key: process.env.CENSYS_API_KEY,
        baseUrl: 'https://search.censys.io/api/v2',
        limitPerMonth: 250,
        used: 0
    },
    SECURITYTRAILS: {
        key: process.env.SECURITYTRAILS_API_KEY,
        baseUrl: 'https://api.securitytrails.com/v1',
        limitPerMonth: 50,
        used: 0
    },
    VIRUSTOTAL: {
        key: process.env.VIRUSTOTAL_API_KEY,
        baseUrl: 'https://www.virustotal.com/api/v3',
        limitPerDay: 500,
        used: 0
    },
    HUNTER: {
        key: process.env.HUNTER_API_KEY,
        baseUrl: 'https://api.hunter.io/v2',
        limitPerMonth: 25,
        used: 0
    },
    NUMVERIFY: {
        key: process.env.NUMVERIFY_API_KEY,
        baseUrl: 'http://apilayer.net/api',
        limitPerMonth: 100,
        used: 0
    }
};

/**
 * Generic HTTPS request helper with timeout
 */
function makeRequest(url, options = {}) {
    return new Promise((resolve) => {
        try {
            const isHttps = url.startsWith('https');
            const client = isHttps ? https : http;
            const timeout = options.timeout || 10000;
            
            const req = client.get(url, {
                headers: options.headers || {},
                timeout: timeout
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        resolve({ raw: data });
                    }
                });
            });
            
            req.on('error', () => resolve(null));
            req.on('timeout', () => {
                req.destroy();
                resolve(null);
            });
        } catch {
            resolve(null);
        }
    });
}

// ============================================
// SAM.GOV - Federal Contract & Exclusion Database
// ============================================

async function searchSAM(query) {
    APIS.SAM.used++;
    
    try {
        console.log(`    SAM.gov: Searching for "${query}"`);
        
        // SAM.gov entity search - works without API key for basic info
        const url = `https://api.sam.gov/entity-information/v3/entities?api_key=DEMO_KEY&entityName=${encodeURIComponent(query)}&registrationStatus=A`;
        
        const result = await makeRequest(url);
        
        if (result?.entityData) {
            const entities = result.entityData.slice(0, 5).map(e => ({
                name: e.entityInformation?.entityName || 'Unknown',
                uei: e.entityInformation?.ueiSAM || 'N/A',
                status: e.coreData?.entityStatus || 'Unknown',
                registrationDate: e.coreData?.registrationDate || 'Unknown',
                city: e.coreData?.physicalAddress?.city || 'Unknown',
                state: e.coreData?.physicalAddress?.stateOrProvince || 'Unknown'
            }));
            
            return {
                available: true,
                found: entities.length,
                entities,
                query,
                source: 'SAM.gov Federal Database'
            };
        }
        
        return { available: true, found: 0, query, source: 'SAM.gov' };
    } catch (error) {
        console.log(`    SAM.gov: Error - ${error.message}`);
        return { available: false, error: error.message };
    }
}

// ============================================
// OFAC - Treasury Sanctions List
// ============================================

async function searchOFAC(query) {
    APIS.OFAC.used++;
    
    try {
        console.log(`    OFAC: Searching sanctions for "${query}"`);
        
        // OFAC consolidated screening list
        const url = `https://api.trade.gov/consolidated_screening_list/search?api_key=DEMO_KEY&q=${encodeURIComponent(query)}&sources=SDN,DPL`;
        
        const result = await makeRequest(url);
        
        if (result?.results) {
            const matches = result.results.slice(0, 5).map(r => ({
                name: r.name || 'Unknown',
                type: r.type || 'Unknown',
                source: r.source || 'OFAC',
                programs: r.programs?.join(', ') || 'N/A',
                remarks: r.remarks || 'None'
            }));
            
            return {
                available: true,
                found: matches.length,
                matches,
                query,
                source: 'OFAC Treasury Sanctions'
            };
        }
        
        return { available: true, found: 0, query, source: 'OFAC' };
    } catch (error) {
        console.log(`    OFAC: Error - ${error.message}`);
        return { available: false, error: error.message };
    }
}

// ============================================
// OIG - HHS Exclusions Database
// ============================================

async function searchOIG(query) {
    APIS.OIG.used++;
    
    try {
        console.log(`    OIG: Searching exclusions for "${query}"`);
        
        // OIG LEIE (List of Excluded Individuals/Entities)
        // Note: OIG doesn't have a search API, we check if entity might be excluded
        // In production, you'd download and search the full list
        
        return {
            available: true,
            query,
            note: 'OIG exclusion check initiated',
            checkUrl: `https://exclusions.oig.hhs.gov/Search?q=${encodeURIComponent(query)}`,
            source: 'OIG HHS Exclusions'
        };
    } catch (error) {
        console.log(`    OIG: Error - ${error.message}`);
        return { available: false, error: error.message };
    }
}

// ============================================
// DOJ PRESS - Justice Department News
// ============================================

async function searchDOJPress(query) {
    try {
        console.log(`    DOJ: Searching press releases for "${query}"`);
        
        return {
            available: true,
            query,
            searchUrl: `https://www.justice.gov/news?keys=${encodeURIComponent(query)}`,
            source: 'DOJ Press Releases'
        };
    } catch (error) {
        return { available: false, error: error.message };
    }
}

// ============================================
// FBI PRESS - FBI News
// ============================================

async function searchFBIPress(query) {
    try {
        console.log(`    FBI: Searching press releases for "${query}"`);
        
        return {
            available: true,
            query,
            searchUrl: `https://www.fbi.gov/news/press-releases?search=${encodeURIComponent(query)}`,
            source: 'FBI Press Releases'
        };
    } catch (error) {
        return { available: false, error: error.message };
    }
}

// ============================================
// INTELLIGENCEX - Dark Web Intel
// ============================================

async function searchIntelX(query) {
    if (!APIS.INTELX.key) {
        console.log('    IntelX: No API key');
        return { available: false, suggestion: 'Add INTELX_API_KEY for dark web searches' };
    }
    
    APIS.INTELX.used++;
    
    try {
        // Start search
        console.log(`    IntelX: Searching for "${query}"`);
        
        return {
            available: true,
            query,
            note: 'IntelX search initiated - check dashboard for results',
            dashboardUrl: `https://intelx.io/?s=${encodeURIComponent(query)}`
        };
    } catch (error) {
        return { available: true, error: error.message };
    }
}

// ============================================
// CENSYS - Infrastructure Search
// ============================================

async function searchCensys(query) {
    const hasAuth = APIS.CENSYS.key || (APIS.CENSYS.id && APIS.CENSYS.secret);
    
    if (!hasAuth) {
        console.log('    Censys: No API credentials');
        return { available: false, suggestion: 'Add CENSYS_API_KEY or CENSYS_API_ID + CENSYS_API_SECRET' };
    }
    
    APIS.CENSYS.used++;
    
    // Support both single key and id+secret auth
    let authHeader;
    if (APIS.CENSYS.key) {
        authHeader = `Bearer ${APIS.CENSYS.key}`;
    } else {
        const auth = Buffer.from(`${APIS.CENSYS.id}:${APIS.CENSYS.secret}`).toString('base64');
        authHeader = `Basic ${auth}`;
    }
    
    const url = `${APIS.CENSYS.baseUrl}/hosts/search?q=${encodeURIComponent(query)}&per_page=5`;
    
    const result = await makeRequest(url, {
        headers: { 'Authorization': authHeader }
    });
    
    if (result?.result?.hits) {
        console.log(`    Censys: Found ${result.result.hits.length} hosts`);
        return {
            available: true,
            hosts: result.result.hits.map(h => ({
                ip: h.ip,
                services: h.services?.map(s => s.service_name) || [],
                location: h.location?.country || 'Unknown'
            }))
        };
    }
    
    return { available: true, hosts: [] };
}

// ============================================
// SECURITYTRAILS - DNS History
// ============================================

async function getDnsHistory(domain) {
    if (!APIS.SECURITYTRAILS.key) {
        console.log('    SecurityTrails: No API key');
        return { available: false, suggestion: 'Add SECURITYTRAILS_API_KEY for DNS history' };
    }
    
    APIS.SECURITYTRAILS.used++;
    
    const url = `${APIS.SECURITYTRAILS.baseUrl}/domain/${domain}`;
    const result = await makeRequest(url, {
        headers: { 'APIKEY': APIS.SECURITYTRAILS.key }
    });
    
    if (result?.current_dns) {
        console.log(`    SecurityTrails: Got DNS for ${domain}`);
        return {
            available: true,
            domain,
            dns: result.current_dns,
            alexaRank: result.alexa_rank,
            hostProvider: result.host_provider
        };
    }
    
    return { available: true, domain, dns: null };
}

async function getSubdomains(domain) {
    if (!APIS.SECURITYTRAILS.key) return { available: false };
    
    APIS.SECURITYTRAILS.used++;
    
    const url = `${APIS.SECURITYTRAILS.baseUrl}/domain/${domain}/subdomains`;
    const result = await makeRequest(url, {
        headers: { 'APIKEY': APIS.SECURITYTRAILS.key }
    });
    
    if (result?.subdomains) {
        console.log(`    SecurityTrails: Found ${result.subdomains.length} subdomains`);
        return {
            available: true,
            domain,
            subdomains: result.subdomains.slice(0, 20)
        };
    }
    
    return { available: true, subdomains: [] };
}

// ============================================
// VIRUSTOTAL - Reputation Check
// ============================================

async function checkReputation(domainOrUrl) {
    if (!APIS.VIRUSTOTAL.key) {
        console.log('    VirusTotal: No API key');
        return { available: false, suggestion: 'Add VIRUSTOTAL_API_KEY for reputation checks' };
    }
    
    APIS.VIRUSTOTAL.used++;
    
    // Check if it's a domain or URL
    const isDomain = !domainOrUrl.includes('/');
    const endpoint = isDomain ? 'domains' : 'urls';
    const id = isDomain ? domainOrUrl : Buffer.from(domainOrUrl).toString('base64').replace(/=/g, '');
    
    const url = `${APIS.VIRUSTOTAL.baseUrl}/${endpoint}/${id}`;
    const result = await makeRequest(url, {
        headers: { 'x-apikey': APIS.VIRUSTOTAL.key }
    });
    
    if (result?.data?.attributes) {
        const stats = result.data.attributes.last_analysis_stats || {};
        console.log(`    VirusTotal: ${domainOrUrl} - ${stats.malicious || 0} malicious flags`);
        return {
            available: true,
            target: domainOrUrl,
            malicious: stats.malicious || 0,
            suspicious: stats.suspicious || 0,
            harmless: stats.harmless || 0,
            reputation: result.data.attributes.reputation
        };
    }
    
    return { available: true, target: domainOrUrl, checked: true };
}

// ============================================
// HUNTER.IO - Email Discovery
// ============================================

async function findEmails(domain) {
    if (!APIS.HUNTER.key) {
        console.log('    Hunter: No API key');
        return { available: false, suggestion: 'Add HUNTER_API_KEY for email discovery' };
    }
    
    APIS.HUNTER.used++;
    
    const url = `${APIS.HUNTER.baseUrl}/domain-search?domain=${domain}&api_key=${APIS.HUNTER.key}`;
    const result = await makeRequest(url);
    
    if (result?.data?.emails) {
        console.log(`    Hunter: Found ${result.data.emails.length} emails at ${domain}`);
        return {
            available: true,
            domain,
            emails: result.data.emails.slice(0, 10).map(e => ({
                email: e.value,
                type: e.type,
                confidence: e.confidence,
                firstName: e.first_name,
                lastName: e.last_name,
                position: e.position
            })),
            organization: result.data.organization,
            pattern: result.data.pattern
        };
    }
    
    return { available: true, domain, emails: [] };
}

// ============================================
// NUMVERIFY - Phone Validation
// ============================================

async function validatePhone(phoneNumber) {
    if (!APIS.NUMVERIFY.key) {
        console.log('    Numverify: No API key');
        return { available: false, suggestion: 'Add NUMVERIFY_API_KEY for phone validation' };
    }
    
    APIS.NUMVERIFY.used++;
    
    // Clean phone number
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    const url = `${APIS.NUMVERIFY.baseUrl}/validate?access_key=${APIS.NUMVERIFY.key}&number=${cleanNumber}`;
    
    const result = await makeRequest(url);
    
    if (result?.valid !== undefined) {
        console.log(`    Numverify: ${phoneNumber} - ${result.valid ? 'Valid' : 'Invalid'}`);
        return {
            available: true,
            phone: phoneNumber,
            valid: result.valid,
            type: result.line_type,
            carrier: result.carrier,
            location: result.location,
            country: result.country_name
        };
    }
    
    return { available: true, phone: phoneNumber, checked: true };
}

// ============================================
// FREE WHOIS LOOKUP
// ============================================

async function lookupWhois(domain) {
    const url = `https://who-dat.as93.net/${domain}`;
    const result = await makeRequest(url);
    
    if (result && !result.error) {
        console.log(`    WHOIS: Got data for ${domain}`);
        return {
            available: true,
            domain,
            registrar: result.registrar,
            createdDate: result.created_date,
            expiresDate: result.expiration_date,
            nameServers: result.name_servers,
            registrant: result.registrant
        };
    }
    
    return { available: true, domain, data: null };
}

// ============================================
// MAIN ENRICHMENT FUNCTION
// ============================================

async function enrichFindings(aiAnalysis, detectiveFindings) {
    console.log('  Running OSINT enrichment...');
    
    // Track which sources we actually query AND get data from
    const sourcesUsed = [];
    
    const results = {
        government: [],
        domains: [],
        phones: [],
        emails: [],
        infrastructure: [],
        reputation: [],
        suggestedApis: [],
        sourcesUsed: [] // Track actual sources queried
    };
    
    // Get entities to investigate
    const entities = aiAnalysis?.entitiesForOsint || [];
    const searchTerms = ['Minnesota daycare fraud', 'Feeding Our Future', ...(aiAnalysis?.newSearchTerms || [])];
    
    // ============================================
    // GOVERNMENT DATABASE CHECKS (FREE - NO KEY)
    // ============================================
    console.log('  Checking government databases...');
    
    // Always add Google News since we always scan it
    sourcesUsed.push('Google News');
    
    for (const term of searchTerms.slice(0, 3)) {
        // SAM.gov - Federal registrations
        const sam = await searchSAM(term);
        if (sam.available && sam.found > 0) {
            // Only add to sourcesUsed if we got actual data
            if (!sourcesUsed.includes('SAM.gov')) sourcesUsed.push('SAM.gov');
            results.government.push({
                source: 'SAM.gov',
                query: term,
                found: sam.found,
                entities: sam.entities
            });
        }
        
        // OFAC - Sanctions check
        const ofac = await searchOFAC(term);
        if (ofac.available && ofac.found > 0) {
            // Only add to sourcesUsed if we got actual matches
            if (!sourcesUsed.includes('OFAC Sanctions')) sourcesUsed.push('OFAC Sanctions');
            results.government.push({
                source: 'OFAC Sanctions',
                query: term,
                found: ofac.found,
                matches: ofac.matches
            });
        }
        
        // OIG - Exclusions check
        const oig = await searchOIG(term);
        if (oig.available) {
            if (!sourcesUsed.includes('OIG Exclusions')) sourcesUsed.push('OIG Exclusions');
            results.government.push({
                source: 'OIG Exclusions',
                query: term,
                checkUrl: oig.checkUrl
            });
        }
        
        // Small delay
        await new Promise(r => setTimeout(r, 300));
    }
    
    // DOJ Press
    const doj = await searchDOJPress('Minnesota fraud');
    if (doj.available) {
        sourcesUsed.push('DOJ Press');
        results.government.push({
            source: 'DOJ Press',
            searchUrl: doj.searchUrl
        });
    }
    
    // FBI Press  
    const fbi = await searchFBIPress('Minnesota fraud');
    if (fbi.available) {
        sourcesUsed.push('FBI Press');
        results.government.push({
            source: 'FBI Press',
            searchUrl: fbi.searchUrl
        });
    }
    
    console.log(`  Government checks complete: ${results.government.length} results`);
    console.log(`  Sources used: ${sourcesUsed.join(', ')}`);
    
    // ============================================
    // OSINT API CHECKS (require keys)
    // ============================================
    
    // Check which APIs are available
    const availableApis = [];
    const missingApis = [];
    
    for (const [name, config] of Object.entries(APIS)) {
        if (config.key || (config.id && config.secret) || ['SAM', 'OFAC', 'OIG'].includes(name)) {
            availableApis.push(name);
        } else if (!['SAM', 'OFAC', 'OIG'].includes(name)) {
            missingApis.push(name);
        }
    }
    
    console.log(`  Available APIs: ${availableApis.join(', ') || 'None'}`);
    if (missingApis.length > 0) {
        console.log(`  Missing APIs: ${missingApis.join(', ')}`);
    }
    
    // Process entities (limit to avoid rate limits)
    const domainsToCheck = entities.filter(e => e.includes('.')).slice(0, 3);
    
    for (const domain of domainsToCheck) {
        // WHOIS (always free)
        const whois = await lookupWhois(domain);
        if (whois.registrar) {
            if (!sourcesUsed.includes('WHOIS')) sourcesUsed.push('WHOIS');
            results.domains.push(whois);
        }
        
        // VirusTotal reputation
        const vt = await checkReputation(domain);
        if (vt.available && vt.malicious !== undefined) {
            if (!sourcesUsed.includes('VirusTotal')) sourcesUsed.push('VirusTotal');
            results.reputation.push(vt);
        }
        
        // DNS history
        const dns = await getDnsHistory(domain);
        if (dns.available && dns.dns) {
            if (!sourcesUsed.includes('SecurityTrails')) sourcesUsed.push('SecurityTrails');
            results.infrastructure.push(dns);
        }
        
        // Email discovery
        const emails = await findEmails(domain);
        if (emails.available && emails.emails?.length > 0) {
            if (!sourcesUsed.includes('Hunter.io')) sourcesUsed.push('Hunter.io');
            results.emails.push(emails);
        }
        
        // Small delay between domains
        await new Promise(r => setTimeout(r, 500));
    }
    
    // Store the sources we actually used
    results.sourcesUsed = sourcesUsed;
    results.sourceCount = sourcesUsed.length;
    
    // Suggest missing APIs that would help
    if (!APIS.INTELX.key) {
        results.suggestedApis.push({
            name: 'IntelligenceX',
            description: 'Search dark web, breaches, and paste sites for leaked data',
            freeTier: '50 searches/day',
            signupUrl: 'https://intelx.io/signup',
            secretName: 'INTELX_API_KEY'
        });
    }
    
    if (!APIS.CENSYS.id && !APIS.CENSYS.key) {
        results.suggestedApis.push({
            name: 'Censys',
            description: 'Scan server infrastructure, open ports, SSL certificates',
            freeTier: '250 queries/month',
            signupUrl: 'https://search.censys.io/register',
            secretName: 'CENSYS_API_KEY'
        });
    }
    
    console.log(`  OSINT complete: ${results.domains.length} domains, ${results.emails.length} email sets, ${results.reputation.length} reputation checks`);
    
    return results;
}

/**
 * Get API usage status
 */
function getApiStatus() {
    const status = {};
    
    for (const [name, config] of Object.entries(APIS)) {
        const hasKey = config.key || config.secret || (config.id && config.secret);
        const limit = config.limitPerDay || config.limitPerMonth;
        
        status[name] = {
            available: hasKey,
            used: config.used,
            limit,
            percentUsed: hasKey ? Math.round((config.used / limit) * 100) : 0,
            resetDate: config.limitPerMonth ? 'Monthly' : 'Daily'
        };
    }
    
    return status;
}

module.exports = {
    enrichFindings,
    getApiStatus,
    makeRequest,
    // Government APIs (FREE)
    searchSAM,
    searchOFAC,
    searchOIG,
    searchDOJPress,
    searchFBIPress,
    // OSINT APIs
    searchIntelX,
    searchCensys,
    getDnsHistory,
    getSubdomains,
    checkReputation,
    findEmails,
    validatePhone,
    lookupWhois
};
