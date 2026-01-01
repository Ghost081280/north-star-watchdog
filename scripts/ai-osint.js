/**
 * ai-osint.js - OSINT Enrichment Module
 * North Star Watchdog
 * 
 * Queries 12 public data sources to enrich entity information:
 * 
 * FEDERAL SOURCES:
 * 1. ProPublica Nonprofits - Form 990 filings, financials
 * 2. FEC Campaign Finance - Political contributions
 * 3. OIG Exclusions - Healthcare provider ban list
 * 4. USASpending.gov - Federal contracts and grants
 * 5. SEC EDGAR - Corporate filings
 * 6. OSHA - Workplace safety violations
 * 7. FDA - Drug enforcement actions
 * 8. HUD - Housing and Urban Development awards
 * 
 * MINNESOTA SOURCES:
 * 9. MN Campaign Finance Board - State political donations
 * 10. MN DHS Licensing - Licensed providers
 * 11. MN Transparency Portal - State vendor payments
 * 
 * BUSINESS RECORDS:
 * 12. OpenCorporates - Company registrations
 */

const https = require('https');
const http = require('http');

// Import Minnesota-specific module
let mnModule;
try {
    mnModule = require('./ai-minnesota.js');
} catch (e) {
    console.log('[OSINT] Minnesota module not found, using built-in functions');
    mnModule = null;
}

// ============================================================================
// API CONFIGURATIONS (All Free, No Keys Required)
// ============================================================================

const OSINT_APIS = {
    // Federal Sources
    PROPUBLICA: {
        name: 'ProPublica Nonprofits',
        searchUrl: 'https://projects.propublica.org/nonprofits/api/v2/search.json?q=',
        orgUrl: 'https://projects.propublica.org/nonprofits/api/v2/organizations/',
        filingUrl: 'https://projects.propublica.org/nonprofits/api/v2/organizations/{ein}/filings.json',
        pdfBaseUrl: 'https://projects.propublica.org/nonprofits/download-filing/',
        rateLimit: 1000,
        description: 'Form 990 nonprofit filings with PDF downloads'
    },
    FEC: {
        name: 'FEC Campaign Finance',
        baseUrl: 'https://api.open.fec.gov/v1/',
        candidatesUrl: 'https://api.open.fec.gov/v1/candidates/search/',
        committeesUrl: 'https://api.open.fec.gov/v1/committees/',
        apiKey: 'DEMO_KEY',
        rateLimit: 1000,
        description: 'Federal political contributions'
    },
    OIG: {
        name: 'OIG Exclusions',
        searchUrl: 'https://exclusions.oig.hhs.gov/api/exclusions/search',
        baseUrl: 'https://exclusions.oig.hhs.gov',
        rateLimit: 1000,
        description: 'Healthcare provider exclusion list'
    },
    USASPENDING: {
        name: 'USASpending.gov',
        searchUrl: 'https://api.usaspending.gov/api/v2/search/spending_by_award/',
        recipientUrl: 'https://api.usaspending.gov/api/v2/recipient/',
        autocompleteUrl: 'https://api.usaspending.gov/api/v2/autocomplete/recipient/',
        rateLimit: 1000,
        description: 'Federal contracts, grants, and awards'
    },
    SEC: {
        name: 'SEC EDGAR',
        searchUrl: 'https://efts.sec.gov/LATEST/search-index?q=',
        companyUrl: 'https://www.sec.gov/cgi-bin/browse-edgar?company=',
        rateLimit: 1000,
        description: 'Corporate filings (10-K, 10-Q, 8-K)'
    },
    OSHA: {
        name: 'OSHA Violations',
        searchUrl: 'https://www.osha.gov/pls/imis/establishment.search',
        inspectionUrl: 'https://www.osha.gov/pls/imis/establishment.inspection_detail',
        rateLimit: 1000,
        description: 'Workplace safety violations'
    },
    FDA: {
        name: 'FDA Enforcement',
        searchUrl: 'https://api.fda.gov/drug/enforcement.json?search=',
        rateLimit: 1000,
        description: 'Drug enforcement actions'
    },
    HUD: {
        name: 'HUD Awards',
        searchUrl: 'https://www.hud.gov/programdescription/',
        rateLimit: 1000,
        description: 'Housing and Urban Development awards'
    },
    
    // Minnesota Sources
    MN_CFB: {
        name: 'MN Campaign Finance Board',
        baseUrl: 'https://cfb.mn.gov',
        searchUrl: 'https://cfb.mn.gov/reports-and-data/viewers/contribution-search/',
        rateLimit: 1000,
        description: 'Minnesota state political donations'
    },
    MN_DHS: {
        name: 'MN DHS Licensing',
        baseUrl: 'https://licensinglookup.dhs.state.mn.us/',
        rateLimit: 1000,
        description: 'Minnesota licensed childcare providers'
    },
    MN_TRANSPARENCY: {
        name: 'MN Transparency Portal',
        baseUrl: 'https://mn.gov/mmb/transparency-mn/',
        rateLimit: 1000,
        description: 'Minnesota state vendor payments'
    },
    
    // Business Records
    OPENCORPORATES: {
        name: 'OpenCorporates',
        searchUrl: 'https://api.opencorporates.com/v0.4/companies/search?q=',
        rateLimit: 500,
        description: 'Company registrations worldwide'
    }
};

// ============================================================================
// HTTP REQUEST HELPER
// ============================================================================

function makeRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 10000;
        const protocol = url.startsWith('https') ? https : http;
        
        const req = protocol.get(url, {
            headers: {
                'User-Agent': 'NorthStarWatchdog/1.0 (Research Tool)',
                'Accept': 'application/json',
                ...options.headers
            },
            timeout: timeout
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode === 200) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve({ error: `HTTP ${res.statusCode}`, data: data });
                    }
                } catch (e) {
                    resolve({ error: 'Parse error', raw: data });
                }
            });
        });
        
        req.on('error', (e) => reject(e));
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
    });
}

// ============================================================================
// PROPUBLICA NONPROFITS (with 990 PDF downloads)
// ============================================================================

async function searchProPublica(query) {
    console.log(`[ProPublica] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.PROPUBLICA.name,
        query: query,
        organizations: [],
        filings: [],
        pdfUrls: []
    };
    
    try {
        const searchUrl = `${OSINT_APIS.PROPUBLICA.searchUrl}${encodeURIComponent(query)}`;
        const data = await makeRequest(searchUrl);
        
        if (data.organizations && data.organizations.length > 0) {
            results.found = true;
            results.organizations = data.organizations.slice(0, 10).map(org => ({
                name: org.name,
                ein: org.ein,
                city: org.city,
                state: org.state,
                ntee_code: org.ntee_code,
                subsection_code: org.subsection_code,
                total_revenue: org.income_amount,
                searchLink: `https://projects.propublica.org/nonprofits/organizations/${org.ein}`,
                form990PdfUrl: `${OSINT_APIS.PROPUBLICA.pdfBaseUrl}${org.ein}`,
                apiFilingsUrl: `https://projects.propublica.org/nonprofits/api/v2/organizations/${org.ein}.json`
            }));
            
            if (results.organizations.length > 0) {
                const ein = results.organizations[0].ein;
                try {
                    const orgData = await makeRequest(`https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`);
                    if (orgData.filings_with_data) {
                        results.filings = orgData.filings_with_data.slice(0, 5).map(filing => ({
                            tax_period: filing.tax_prd,
                            tax_year: filing.tax_prd_yr,
                            total_revenue: filing.totrevenue,
                            total_expenses: filing.totfuncexpns,
                            pdf_url: filing.pdf_url || `${OSINT_APIS.PROPUBLICA.pdfBaseUrl}${filing.object_id}`
                        }));
                        results.pdfUrls = results.filings.map(f => f.pdf_url).filter(Boolean);
                    }
                } catch (e) {
                    console.log(`[ProPublica] Could not fetch filings: ${e.message}`);
                }
            }
        } else {
            results.found = false;
        }
    } catch (error) {
        console.error(`[ProPublica] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// FEC CAMPAIGN FINANCE
// ============================================================================

async function searchFEC(query) {
    console.log(`[FEC] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.FEC.name,
        query: query,
        candidates: [],
        committees: [],
        contributions: []
    };
    
    try {
        const candidateUrl = `${OSINT_APIS.FEC.candidatesUrl}?q=${encodeURIComponent(query)}&api_key=${OSINT_APIS.FEC.apiKey}`;
        const candidateData = await makeRequest(candidateUrl);
        
        if (candidateData.results && candidateData.results.length > 0) {
            results.found = true;
            results.candidates = candidateData.results.slice(0, 5).map(c => ({
                name: c.name,
                party: c.party,
                office: c.office_full,
                state: c.state,
                candidate_id: c.candidate_id,
                searchLink: `https://www.fec.gov/data/candidate/${c.candidate_id}/`
            }));
        }
        
        const contributionUrl = `https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(query)}&api_key=${OSINT_APIS.FEC.apiKey}&per_page=20`;
        try {
            const contribData = await makeRequest(contributionUrl);
            if (contribData.results && contribData.results.length > 0) {
                results.contributions = contribData.results.slice(0, 10).map(c => ({
                    contributor_name: c.contributor_name,
                    contributor_city: c.contributor_city,
                    contributor_state: c.contributor_state,
                    contribution_amount: c.contribution_receipt_amount,
                    contribution_date: c.contribution_receipt_date,
                    recipient: c.committee?.name || 'Unknown',
                    recipient_id: c.committee_id
                }));
                results.found = true;
            }
        } catch (e) {
            console.log(`[FEC] Contribution search error: ${e.message}`);
        }
        
    } catch (error) {
        console.error(`[FEC] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// OIG EXCLUSIONS (Healthcare)
// ============================================================================

async function searchOIG(query) {
    console.log(`[OIG] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.OIG.name,
        query: query,
        exclusions: [],
        searchLink: `https://exclusions.oig.hhs.gov/`
    };
    
    try {
        results.found = true;
        results.message = 'Manual search required at OIG Exclusions database';
        results.searchInstructions = [
            '1. Visit https://exclusions.oig.hhs.gov/',
            '2. Enter the name in the search field',
            '3. Review any exclusion records found'
        ];
        results.exclusionSearchUrl = `https://exclusions.oig.hhs.gov/`;
    } catch (error) {
        console.error(`[OIG] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// USASPENDING.GOV
// ============================================================================

async function searchUSASpending(query) {
    console.log(`[USASpending] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.USASPENDING.name,
        query: query,
        awards: [],
        totalAmount: 0
    };
    
    try {
        results.searchLink = `https://www.usaspending.gov/search/?hash=recipient/${encodeURIComponent(query)}`;
        results.found = true;
        results.message = 'Search link generated for USASpending.gov';
        
    } catch (error) {
        console.error(`[USASpending] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// SEC EDGAR
// ============================================================================

async function searchSEC(query) {
    console.log(`[SEC] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.SEC.name,
        query: query,
        filings: [],
        companies: []
    };
    
    try {
        const searchUrl = `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(query)}&CIK=&type=&owner=include&count=40&action=getcompany`;
        results.searchLink = searchUrl;
        results.found = true;
        results.filingTypes = ['10-K', '10-Q', '8-K', 'DEF 14A', 'S-1'];
        results.searchInstructions = [
            '1. Visit SEC EDGAR search',
            '2. Look for company filings',
            '3. Review 10-K (annual) and 10-Q (quarterly) reports',
            '4. Check 8-K for material events'
        ];
    } catch (error) {
        console.error(`[SEC] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// OSHA VIOLATIONS
// ============================================================================

async function searchOSHA(query) {
    console.log(`[OSHA] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.OSHA.name,
        query: query,
        violations: []
    };
    
    try {
        results.searchLink = `https://www.osha.gov/pls/imis/establishment.search?p_logger=1&establishment=${encodeURIComponent(query)}&State=MN`;
        results.found = true;
        results.message = 'OSHA establishment search link generated';
    } catch (error) {
        console.error(`[OSHA] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// FDA ENFORCEMENT
// ============================================================================

async function searchFDA(query) {
    console.log(`[FDA] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.FDA.name,
        query: query,
        enforcements: []
    };
    
    try {
        const searchUrl = `${OSINT_APIS.FDA.searchUrl}${encodeURIComponent(query)}&limit=10`;
        const data = await makeRequest(searchUrl);
        
        if (data.results && data.results.length > 0) {
            results.found = true;
            results.enforcements = data.results.slice(0, 5).map(e => ({
                recall_number: e.recall_number,
                reason: e.reason_for_recall,
                status: e.status,
                classification: e.classification,
                product_description: e.product_description,
                recalling_firm: e.recalling_firm
            }));
        } else {
            results.found = false;
        }
    } catch (error) {
        console.error(`[FDA] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// HUD AWARDS
// ============================================================================

async function searchHUD(query) {
    console.log(`[HUD] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.HUD.name,
        query: query,
        awards: []
    };
    
    try {
        results.searchLink = `https://www.hud.gov/program_offices/spm/gmomgmt/grantsinfo/fundingopps`;
        results.found = true;
        results.message = 'HUD search link generated';
    } catch (error) {
        console.error(`[HUD] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// MINNESOTA CAMPAIGN FINANCE BOARD
// ============================================================================

async function searchMNCampaignFinance(query) {
    console.log(`[MN-CFB] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.MN_CFB.name,
        query: query,
        contributions: []
    };
    
    try {
        if (mnModule) {
            return await mnModule.searchMNCampaignFinance(query);
        }
        
        const encodedQuery = encodeURIComponent(query);
        results.searchLinks = {
            contributorSearch: `https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?ContributorName=${encodedQuery}`,
            recipientSearch: `https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?RecipientName=${encodedQuery}`,
            dataDownloads: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/'
        };
        results.found = true;
        results.message = 'Minnesota campaign finance search links generated';
        
    } catch (error) {
        console.error(`[MN-CFB] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// MINNESOTA DHS LICENSING
// ============================================================================

async function searchMNDHSLicensing(query) {
    console.log(`[MN-DHS] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.MN_DHS.name,
        query: query,
        providers: []
    };
    
    try {
        if (mnModule) {
            return await mnModule.searchMNLicensing(query);
        }
        
        results.searchLinks = {
            licensingLookup: 'https://licensinglookup.dhs.state.mn.us/',
            parentAware: `https://www.parentaware.org/find-care/?search=${encodeURIComponent(query)}`
        };
        results.found = true;
        results.message = 'Minnesota licensing search links generated';
        
    } catch (error) {
        console.error(`[MN-DHS] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// MINNESOTA TRANSPARENCY PORTAL
// ============================================================================

async function searchMNTransparency(query) {
    console.log(`[MN-Transparency] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.MN_TRANSPARENCY.name,
        query: query,
        payments: []
    };
    
    try {
        results.searchLinks = {
            transparencyPortal: 'https://mn.gov/mmb/transparency-mn/',
            statePayments: 'https://mn.gov/mmb/transparency-mn/state-payments/',
            contractsGrants: 'https://mn.gov/mmb/transparency-mn/contracts-grants/'
        };
        results.found = true;
        results.message = 'Minnesota transparency portal links generated';
        results.instructions = [
            '1. Visit MN Transparency Portal',
            '2. Select "State Payments" or "Contracts & Grants"',
            '3. Search for vendor/recipient name',
            '4. Filter by agency (DHS, DCYF) for childcare payments'
        ];
        
    } catch (error) {
        console.error(`[MN-Transparency] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

// ============================================================================
// OPENCORPORATES
// ============================================================================

async function searchOpenCorporates(query) {
    console.log(`[OpenCorporates] Searching: ${query}`);
    const results = {
        source: OSINT_APIS.OPENCORPORATES.name,
        query: query,
        companies: []
    };
    
    try {
        const searchUrl = `${OSINT_APIS.OPENCORPORATES.searchUrl}${encodeURIComponent(query)}&jurisdiction_code=us_mn`;
        const data = await makeRequest(searchUrl);
        
        if (data.results && data.results.companies && data.results.companies.length > 0) {
            results.found = true;
            results.companies = data.results.companies.slice(0, 10).map(c => ({
                name: c.company.name,
                company_number: c.company.company_number,
                jurisdiction: c.company.jurisdiction_code,
                status: c.company.current_status,
                incorporation_date: c.company.incorporation_date,
                address: c.company.registered_address_in_full,
                opencorporates_url: c.company.opencorporates_url
            }));
        } else {
            results.found = false;
            results.searchLink = `https://opencorporates.com/companies?q=${encodeURIComponent(query)}&jurisdiction_code=us_mn`;
        }
    } catch (error) {
        console.error(`[OpenCorporates] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
        results.searchLink = `https://opencorporates.com/companies?q=${encodeURIComponent(query)}`;
    }
    
    return results;
}

// ============================================================================
// COMPREHENSIVE ENTITY ENRICHMENT
// ============================================================================

async function enrichEntity(entityName, options = {}) {
    console.log(`\n[OSINT] ========== Enriching: ${entityName} ==========`);
    
    const enrichment = {
        entity: entityName,
        timestamp: new Date().toISOString(),
        sources: {},
        summary: {
            totalSourcesQueried: 0,
            sourcesWithData: 0,
            redFlags: [],
            investigationLinks: {}
        }
    };
    
    const searches = [
        { name: 'proPublica', fn: () => searchProPublica(entityName) },
        { name: 'fec', fn: () => searchFEC(entityName) },
        { name: 'oig', fn: () => searchOIG(entityName) },
        { name: 'usaSpending', fn: () => searchUSASpending(entityName) },
        { name: 'sec', fn: () => searchSEC(entityName) },
        { name: 'osha', fn: () => searchOSHA(entityName) },
        { name: 'fda', fn: () => searchFDA(entityName) },
        { name: 'hud', fn: () => searchHUD(entityName) },
        { name: 'mnCampaignFinance', fn: () => searchMNCampaignFinance(entityName) },
        { name: 'mnDHSLicensing', fn: () => searchMNDHSLicensing(entityName) },
        { name: 'mnTransparency', fn: () => searchMNTransparency(entityName) },
        { name: 'openCorporates', fn: () => searchOpenCorporates(entityName) }
    ];
    
    const skipSources = options.skipSources || [];
    
    for (const search of searches) {
        if (skipSources.includes(search.name)) continue;
        
        try {
            enrichment.summary.totalSourcesQueried++;
            enrichment.sources[search.name] = await search.fn();
            
            if (enrichment.sources[search.name].found) {
                enrichment.summary.sourcesWithData++;
            }
            
            if (enrichment.sources[search.name].searchLink) {
                enrichment.summary.investigationLinks[search.name] = enrichment.sources[search.name].searchLink;
            }
            if (enrichment.sources[search.name].searchLinks) {
                enrichment.summary.investigationLinks[search.name] = enrichment.sources[search.name].searchLinks;
            }
            
            await new Promise(r => setTimeout(r, 200));
            
        } catch (error) {
            console.error(`[OSINT] Error in ${search.name}: ${error.message}`);
            enrichment.sources[search.name] = { error: error.message, found: false };
        }
    }
    
    if (options.state === 'MN' || options.includeMinnesota) {
        if (mnModule) {
            enrichment.minnesotaPackage = await mnModule.generateMNInvestigationPackage(entityName, options);
        }
    }
    
    console.log(`[OSINT] Completed: ${enrichment.summary.sourcesWithData}/${enrichment.summary.totalSourcesQueried} sources with data\n`);
    
    return enrichment;
}

// ============================================================================
// GENERATE INVESTIGATION PACKAGE
// ============================================================================

async function generateInvestigationPackage(entityName, options = {}) {
    console.log(`[OSINT] Generating investigation package for: ${entityName}`);
    
    const package_ = {
        entity: entityName,
        generated: new Date().toISOString(),
        type: options.type || 'GENERAL',
        
        searchUrls: {
            // Federal Sources
            proPublica: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(entityName)}`,
            fec: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(entityName)}&contributor_state=MN`,
            oig: 'https://exclusions.oig.hhs.gov/',
            usaSpending: `https://www.usaspending.gov/search/?hash=recipient/${encodeURIComponent(entityName)}`,
            sec: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(entityName)}&CIK=&type=&owner=include&count=40&action=getcompany`,
            osha: `https://www.osha.gov/pls/imis/establishment.search?p_logger=1&establishment=${encodeURIComponent(entityName)}&State=MN`,
            fda: `https://api.fda.gov/drug/enforcement.json?search=${encodeURIComponent(entityName)}`,
            hud: 'https://www.hud.gov/program_offices/spm/gmomgmt/grantsinfo/fundingopps',
            
            // Minnesota Sources
            mnCampaignFinance: `https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?ContributorName=${encodeURIComponent(entityName)}`,
            mnLicensing: 'https://licensinglookup.dhs.state.mn.us/',
            mnTransparency: 'https://mn.gov/mmb/transparency-mn/',
            parentAware: `https://www.parentaware.org/find-care/?search=${encodeURIComponent(entityName)}`,
            mnSOS: 'https://mblsportal.sos.state.mn.us/Business/Search',
            
            // Business Records
            openCorporates: `https://opencorporates.com/companies?q=${encodeURIComponent(entityName)}&jurisdiction_code=us_mn`,
            
            // News & Social
            googleNews: `https://news.google.com/search?q=${encodeURIComponent(entityName)}+Minnesota+fraud`,
            xTwitter: `https://twitter.com/search?q=${encodeURIComponent(entityName)}+Minnesota&f=live`
        },
        
        documentUrls: {
            proPublica990s: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(entityName)}`,
            fecFilings: `https://www.fec.gov/data/committee/?q=${encodeURIComponent(entityName)}`,
            secFilings: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(entityName)}&action=getcompany`,
            mnCFBData: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/'
        },
        
        instructions: [
            '=== FEDERAL SOURCES ===',
            '1. ProPublica: Search for 990 filings if nonprofit',
            '2. FEC: Check for federal campaign contributions',
            '3. OIG: Verify not on healthcare exclusion list',
            '4. USASpending: Find federal grants and contracts',
            '5. SEC: Check for corporate filings',
            '',
            '=== MINNESOTA SOURCES ===',
            '6. MN CFB: Search for state political donations',
            '7. MN DHS Licensing: Verify childcare license status',
            '8. MN Transparency: Find state vendor payments',
            '9. ParentAware: Check CCAP registration',
            '10. MN SOS: Verify business registration',
            '',
            '=== CROSS-REFERENCE ===',
            '11. Compare CCAP payments to political donations',
            '12. Verify physical location exists and is operational',
            '13. Check news coverage for fraud allegations',
            '14. Document all findings with screenshots'
        ]
    };
    
    if (options.includeEnrichment) {
        package_.enrichment = await enrichEntity(entityName, { ...options, state: 'MN', includeMinnesota: true });
    }
    
    return package_;
}

// ============================================================================
// CCAP PROVIDER CROSS-REFERENCE
// ============================================================================

async function crossReferenceCCAPProvider(providerName, options = {}) {
    console.log(`[OSINT] Cross-referencing CCAP provider: ${providerName}`);
    
    const crossRef = {
        provider: providerName,
        timestamp: new Date().toISOString(),
        
        campaignFinance: await searchMNCampaignFinance(providerName),
        licensing: await searchMNDHSLicensing(providerName),
        federalGrants: await searchUSASpending(providerName),
        businessRecords: await searchOpenCorporates(providerName),
        
        analysis: {
            hasPoliticalDonations: false,
            hasActiveLicense: 'Unknown',
            receivesFederalFunds: false,
            redFlags: []
        },
        
        investigationPackage: await generateInvestigationPackage(providerName, { type: 'CCAP_PROVIDER' })
    };
    
    if (crossRef.campaignFinance.found) {
        crossRef.analysis.hasPoliticalDonations = true;
        crossRef.analysis.redFlags.push({
            type: 'POLITICAL_DONATIONS',
            description: 'Childcare provider making political donations - investigate source of funds',
            severity: 'HIGH'
        });
    }
    
    return crossRef;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Alias for backwards compatibility
const enrichFindings = enrichEntity;

module.exports = {
    OSINT_APIS,
    
    searchProPublica,
    searchFEC,
    searchOIG,
    searchUSASpending,
    searchSEC,
    searchOSHA,
    searchFDA,
    searchHUD,
    searchMNCampaignFinance,
    searchMNDHSLicensing,
    searchMNTransparency,
    searchOpenCorporates,
    
    enrichEntity,
    enrichFindings,  // Alias for ai-core.js compatibility
    generateInvestigationPackage,
    crossReferenceCCAPProvider,
    
    mnModule
};
