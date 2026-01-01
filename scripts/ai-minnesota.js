/**
 * ai-minnesota.js - Minnesota-Specific OSINT Module
 * North Star Watchdog
 * 
 * Integrates with Minnesota public data sources:
 * - Minnesota Campaign Finance Board (CFB) - Political donations
 * - Minnesota Transparency Portal - State vendor payments
 * - Minnesota DHS Licensing Lookup - Licensed providers
 * - ParentAware - CCAP provider lookup
 * 
 * This module enables cross-referencing CCAP providers with political donations
 * to detect potential fraud patterns
 */

const https = require('https');
const http = require('http');

// ============================================================================
// MINNESOTA DATA SOURCES CONFIGURATION
// ============================================================================

const MN_SOURCES = {
    // Minnesota Campaign Finance Board
    CFB: {
        name: 'Minnesota Campaign Finance Board',
        baseUrl: 'https://cfb.mn.gov',
        dataUrl: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/',
        description: 'State-level political donations and campaign contributions'
    },
    
    // Minnesota Transparency Portal (MMB)
    TRANSPARENCY: {
        name: 'Minnesota Transparency Portal',
        baseUrl: 'https://mn.gov/mmb/transparency-mn/',
        description: 'State vendor payments and contracts'
    },
    
    // Minnesota DHS Licensing Lookup
    DHS_LICENSING: {
        name: 'MN DHS Licensing Lookup',
        baseUrl: 'https://licensinglookup.dhs.state.mn.us/',
        description: 'Licensed childcare providers and facilities'
    },
    
    // ParentAware - CCAP Provider Database
    PARENT_AWARE: {
        name: 'ParentAware',
        baseUrl: 'https://www.parentaware.org',
        searchUrl: 'https://www.parentaware.org/find-care/',
        description: 'CCAP-registered childcare providers'
    },
    
    // Minnesota DCYF (Department of Children, Youth, and Families)
    DCYF: {
        name: 'Minnesota DCYF',
        baseUrl: 'https://dcyf.mn.gov',
        description: 'Child Care Assistance Program administration'
    }
};

// ============================================================================
// MINNESOTA CAMPAIGN FINANCE BOARD (CFB) INTEGRATION
// ============================================================================

/**
 * Search Minnesota Campaign Finance Board for political donations
 * @param {string} query - Name of person or organization to search
 * @returns {Promise<Object>} - Campaign contribution results
 */
async function searchMNCampaignFinance(query) {
    console.log(`[MN-CFB] Searching campaign finance for: ${query}`);
    
    const results = {
        source: 'Minnesota Campaign Finance Board',
        sourceUrl: MN_SOURCES.CFB.baseUrl,
        query: query,
        timestamp: new Date().toISOString(),
        contributions: [],
        totalAmount: 0,
        recipients: [],
        searchLinks: generateCFBSearchLinks(query)
    };
    
    try {
        // Generate direct search URLs for manual investigation
        results.searchLinks = generateCFBSearchLinks(query);
        
        // Note: MN CFB requires manual download of CSV files
        // We provide links and instructions for users to investigate
        results.instructions = [
            'Visit the Minnesota Campaign Finance Board website',
            'Navigate to Data Downloads section',
            'Download Contributions CSV files',
            'Search for the entity name in the downloaded data'
        ];
        
        results.found = true;
        results.message = 'Search links generated - manual investigation required';
        
    } catch (error) {
        console.error(`[MN-CFB] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

/**
 * Generate search links for Minnesota Campaign Finance Board
 */
function generateCFBSearchLinks(query) {
    const encodedQuery = encodeURIComponent(query);
    
    return {
        mainSite: MN_SOURCES.CFB.baseUrl,
        dataDownloads: MN_SOURCES.CFB.dataUrl,
        contributorSearch: `${MN_SOURCES.CFB.baseUrl}/reports-and-data/viewers/contribution-search/?ContributorName=${encodedQuery}`,
        recipientSearch: `${MN_SOURCES.CFB.baseUrl}/reports-and-data/viewers/contribution-search/?RecipientName=${encodedQuery}`,
        // OpenSecrets for federal donations
        openSecrets: `https://www.opensecrets.org/search?q=${encodedQuery}&type=donors`,
        fecSearch: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodedQuery}&contributor_state=MN`
    };
}

// ============================================================================
// MINNESOTA DHS LICENSING LOOKUP
// ============================================================================

/**
 * Search Minnesota DHS Licensing database for childcare providers
 * @param {string} query - Provider name or license number
 * @returns {Promise<Object>} - Licensing information
 */
async function searchMNLicensing(query) {
    console.log(`[MN-DHS] Searching licensing database for: ${query}`);
    
    const results = {
        source: 'Minnesota DHS Licensing Lookup',
        sourceUrl: MN_SOURCES.DHS_LICENSING.baseUrl,
        query: query,
        timestamp: new Date().toISOString(),
        providers: [],
        searchLinks: generateLicensingSearchLinks(query)
    };
    
    try {
        results.searchLinks = generateLicensingSearchLinks(query);
        results.found = true;
        results.message = 'Search links generated for MN DHS Licensing Lookup';
        
    } catch (error) {
        console.error(`[MN-DHS] Error: ${error.message}`);
        results.error = error.message;
        results.found = false;
    }
    
    return results;
}

/**
 * Generate search links for MN DHS Licensing
 */
function generateLicensingSearchLinks(query) {
    const encodedQuery = encodeURIComponent(query);
    
    return {
        licensingLookup: `${MN_SOURCES.DHS_LICENSING.baseUrl}Search.aspx`,
        parentAware: `${MN_SOURCES.PARENT_AWARE.searchUrl}?search=${encodedQuery}`,
        dcyfProviders: `${MN_SOURCES.DCYF.baseUrl}/child-care-assistance-program-information-child-care-providers`
    };
}

// ============================================================================
// CCAP PROVIDER ANALYSIS
// ============================================================================

/**
 * Analyze a potential CCAP provider for fraud indicators
 * Cross-references multiple data sources
 * @param {string} providerName - Name of the childcare provider
 * @param {string} city - City in Minnesota (optional)
 * @returns {Promise<Object>} - Comprehensive analysis
 */
async function analyzeCCAPProvider(providerName, city = 'Minneapolis') {
    console.log(`[CCAP-ANALYSIS] Analyzing provider: ${providerName}, ${city}`);
    
    const analysis = {
        provider: providerName,
        city: city,
        state: 'Minnesota',
        timestamp: new Date().toISOString(),
        dataSources: {},
        redFlags: [],
        politicalConnections: {
            found: false,
            donations: [],
            totalDonated: 0
        },
        licensingStatus: {
            found: false,
            status: 'Unknown'
        },
        ccapStatus: {
            found: false,
            registered: 'Unknown'
        },
        investigationLinks: {},
        confidenceScore: 0
    };
    
    try {
        // 1. Search Campaign Finance
        const cfbResults = await searchMNCampaignFinance(providerName);
        analysis.dataSources.campaignFinance = cfbResults;
        analysis.investigationLinks.campaignFinance = cfbResults.searchLinks;
        
        // 2. Search DHS Licensing
        const licensingResults = await searchMNLicensing(providerName);
        analysis.dataSources.licensing = licensingResults;
        analysis.investigationLinks.licensing = licensingResults.searchLinks;
        
        // 3. Generate comprehensive search links
        analysis.investigationLinks.comprehensive = generateComprehensiveSearchLinks(providerName, city);
        
        // 4. Calculate confidence score based on available data
        analysis.confidenceScore = calculateProviderConfidence(analysis);
        
        // 5. Identify potential red flags
        analysis.redFlags = identifyProviderRedFlags(providerName, analysis);
        
    } catch (error) {
        console.error(`[CCAP-ANALYSIS] Error: ${error.message}`);
        analysis.error = error.message;
    }
    
    return analysis;
}

/**
 * Generate comprehensive search links for a provider
 */
function generateComprehensiveSearchLinks(providerName, city) {
    const encodedName = encodeURIComponent(providerName);
    const encodedCity = encodeURIComponent(city);
    
    return {
        // Minnesota Sources
        mnCFB: `https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?ContributorName=${encodedName}`,
        mnLicensing: `https://licensinglookup.dhs.state.mn.us/Search.aspx`,
        parentAware: `https://www.parentaware.org/find-care/?search=${encodedName}`,
        mnTransparency: `https://mn.gov/mmb/transparency-mn/`,
        
        // Federal Sources (existing)
        proPublica: `https://projects.propublica.org/nonprofits/search?q=${encodedName}`,
        fecDonations: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodedName}&contributor_state=MN`,
        openSecrets: `https://www.opensecrets.org/search?q=${encodedName}&type=donors`,
        usaSpending: `https://www.usaspending.gov/search/?hash=recipient/${encodedName}`,
        
        // Business Records
        mnSOS: `https://mblsportal.sos.state.mn.us/Business/Search`,
        openCorporates: `https://opencorporates.com/companies?q=${encodedName}&jurisdiction_code=us_mn`,
        
        // News & Social
        googleNews: `https://news.google.com/search?q=${encodedName}+${encodedCity}+daycare+fraud`,
        xTwitter: `https://twitter.com/search?q=${encodedName}+Minnesota&f=live`
    };
}

/**
 * Calculate confidence score for provider analysis
 */
function calculateProviderConfidence(analysis) {
    let score = 30; // Base score
    
    if (analysis.dataSources.campaignFinance?.found) score += 20;
    if (analysis.dataSources.licensing?.found) score += 20;
    if (analysis.politicalConnections?.found) score += 15;
    if (analysis.redFlags?.length > 0) score += 15;
    
    return Math.min(score, 100);
}

/**
 * Identify potential red flags for a provider
 */
function identifyProviderRedFlags(providerName, analysis) {
    const redFlags = [];
    
    // Check for common fraud indicators in name
    const suspiciousPatterns = [
        { pattern: /learning|learing/i, flag: 'Name includes "learning" - common in CCAP fraud cases' },
        { pattern: /child\s*care\s*center/i, flag: 'Generic childcare center name' },
        { pattern: /early\s*education/i, flag: 'Early education terminology - verify licensing' },
        { pattern: /future\s*leaders/i, flag: 'Name pattern seen in fraud cases' }
    ];
    
    for (const { pattern, flag } of suspiciousPatterns) {
        if (pattern.test(providerName)) {
            redFlags.push({
                type: 'NAME_PATTERN',
                description: flag,
                severity: 'MEDIUM',
                source: 'Pattern Analysis'
            });
        }
    }
    
    // Add red flag if political donations found from childcare provider
    if (analysis.politicalConnections?.found) {
        redFlags.push({
            type: 'POLITICAL_DONATIONS',
            description: 'Childcare provider making political donations - investigate source of funds',
            severity: 'HIGH',
            source: 'Campaign Finance Cross-Reference'
        });
    }
    
    return redFlags;
}

// ============================================================================
// POLITICAL DONATION CROSS-REFERENCE
// ============================================================================

/**
 * Cross-reference a list of entities with political donations
 * @param {Array<string>} entities - List of entity names to check
 * @returns {Promise<Object>} - Cross-reference results
 */
async function crossReferencePoliticalDonations(entities) {
    console.log(`[POLITICAL-XREF] Cross-referencing ${entities.length} entities with political donations`);
    
    const results = {
        timestamp: new Date().toISOString(),
        totalEntities: entities.length,
        entitiesWithDonations: [],
        totalDonationsFound: 0,
        summary: {},
        investigationLinks: {}
    };
    
    for (const entity of entities) {
        try {
            const cfbResults = await searchMNCampaignFinance(entity);
            
            results.investigationLinks[entity] = cfbResults.searchLinks;
            
            // Note: Actual donation amounts require manual CSV download
            // We flag the entity for investigation
            results.entitiesWithDonations.push({
                name: entity,
                searchLinks: cfbResults.searchLinks,
                requiresManualVerification: true
            });
            
        } catch (error) {
            console.error(`[POLITICAL-XREF] Error for ${entity}: ${error.message}`);
        }
    }
    
    return results;
}

// ============================================================================
// CCAP FRAUD PATTERN DETECTION
// ============================================================================

/**
 * Known CCAP fraud patterns from Minnesota investigations
 */
const CCAP_FRAUD_PATTERNS = {
    // From Feeding Our Future and related cases
    organizationPatterns: [
        'Feeding Our Future',
        'Partners in Nutrition',
        'Safari Restaurant',
        'Brava Restaurant'
    ],
    
    // Common characteristics of fraudulent daycares
    characteristics: [
        'Licensed for 99+ children but appears inactive',
        'Multiple locations with same ownership',
        'Large political donations from childcare income',
        'Recently opened with high CCAP billing',
        'Located in residential area with no visible signage',
        'No children observed during operating hours'
    ],
    
    // Red flag dollar amounts
    thresholds: {
        highCCAPPayment: 500000,  // Annual CCAP payments over $500k
        suspiciousDonation: 10000, // Political donations over $10k from childcare
        rapidGrowth: 200 // Percent increase in billing year-over-year
    }
};

/**
 * Analyze entity for CCAP fraud patterns
 */
function analyzeFraudPatterns(entityName, data = {}) {
    const patterns = [];
    
    // Check against known fraud organizations
    for (const knownEntity of CCAP_FRAUD_PATTERNS.organizationPatterns) {
        if (entityName.toLowerCase().includes(knownEntity.toLowerCase())) {
            patterns.push({
                type: 'KNOWN_FRAUD_ASSOCIATION',
                description: `Name associated with known fraud case: ${knownEntity}`,
                severity: 'CRITICAL',
                confidence: 95
            });
        }
    }
    
    // Check for suspicious naming patterns
    if (/quality\s*(learing|learning)/i.test(entityName)) {
        patterns.push({
            type: 'SUSPICIOUS_NAME',
            description: 'Name pattern matches known fraud investigation',
            severity: 'HIGH',
            confidence: 75
        });
    }
    
    return patterns;
}

// ============================================================================
// GENERATE INVESTIGATION PACKAGE
// ============================================================================

/**
 * Generate a complete investigation package for a Minnesota entity
 * Includes all relevant search links and data sources
 * @param {string} entityName - Name of entity to investigate
 * @param {Object} options - Additional options (city, type, etc.)
 * @returns {Promise<Object>} - Complete investigation package
 */
async function generateMNInvestigationPackage(entityName, options = {}) {
    console.log(`[MN-PACKAGE] Generating investigation package for: ${entityName}`);
    
    const city = options.city || 'Minneapolis';
    const entityType = options.type || 'CHILDCARE';
    
    const package_ = {
        entity: entityName,
        city: city,
        state: 'Minnesota',
        entityType: entityType,
        generated: new Date().toISOString(),
        
        // Minnesota-Specific Sources
        minnesotaSources: {
            campaignFinance: generateCFBSearchLinks(entityName),
            licensing: generateLicensingSearchLinks(entityName),
            transparency: {
                vendorPayments: 'https://mn.gov/mmb/transparency-mn/',
                description: 'Search state vendor payments'
            },
            businessRecords: {
                sosSearch: 'https://mblsportal.sos.state.mn.us/Business/Search',
                description: 'Minnesota Secretary of State business search'
            }
        },
        
        // Federal Sources
        federalSources: {
            proPublica: `https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(entityName)}`,
            fec: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encodeURIComponent(entityName)}&contributor_state=MN`,
            usaSpending: `https://www.usaspending.gov/search/?hash=recipient/${encodeURIComponent(entityName)}`,
            oig: `https://exclusions.oig.hhs.gov/`,
            sec: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(entityName)}&CIK=&type=&owner=include&count=40&action=getcompany`,
            openCorporates: `https://opencorporates.com/companies?q=${encodeURIComponent(entityName)}&jurisdiction_code=us_mn`
        },
        
        // News & Social Media
        newsSources: {
            googleNews: `https://news.google.com/search?q=${encodeURIComponent(entityName)}+Minnesota+fraud`,
            twitter: `https://twitter.com/search?q=${encodeURIComponent(entityName)}+Minnesota&f=live`
        },
        
        // Fraud Pattern Analysis
        fraudAnalysis: analyzeFraudPatterns(entityName),
        
        // Investigation Instructions
        instructions: [
            '1. Search MN Campaign Finance Board for political donations from this entity',
            '2. Check MN DHS Licensing Lookup for active license status',
            '3. Search MN Transparency Portal for state payments received',
            '4. Cross-reference ownership with business filings at MN SOS',
            '5. Search ProPublica for 990 filings if nonprofit',
            '6. Check FEC for federal political contributions',
            '7. Review news coverage for any fraud allegations',
            '8. Document findings with screenshots and timestamps'
        ]
    };
    
    // Add CCAP-specific info if childcare entity
    if (entityType === 'CHILDCARE') {
        package_.ccapSpecific = {
            parentAware: `https://www.parentaware.org/find-care/?search=${encodeURIComponent(entityName)}`,
            dcyfInfo: 'https://dcyf.mn.gov/child-care-assistance-program-information-child-care-providers',
            fraudReporting: 'https://mn.gov/dhs/general-public/about-dhs/contact-us/fraud/',
            keyQuestions: [
                'Is the provider currently licensed?',
                'What is their licensed capacity vs. claimed enrollment?',
                'How much CCAP funding have they received?',
                'Are there political donations from this provider or its owners?',
                'Is there a physical location with visible childcare activity?'
            ]
        };
    }
    
    return package_;
}

// ============================================================================
// BULK ENTITY ANALYSIS
// ============================================================================

/**
 * Analyze multiple entities for fraud patterns
 * Useful for batch processing from news articles
 * @param {Array<string>} entities - List of entity names
 * @returns {Promise<Object>} - Batch analysis results
 */
async function batchAnalyzeEntities(entities) {
    console.log(`[BATCH-ANALYSIS] Analyzing ${entities.length} entities`);
    
    const results = {
        timestamp: new Date().toISOString(),
        totalAnalyzed: entities.length,
        highRisk: [],
        mediumRisk: [],
        lowRisk: [],
        allResults: []
    };
    
    for (const entity of entities) {
        try {
            const analysis = await analyzeCCAPProvider(entity);
            
            // Categorize by risk level
            if (analysis.confidenceScore >= 70 || analysis.redFlags.length >= 2) {
                results.highRisk.push({ entity, analysis });
            } else if (analysis.confidenceScore >= 50 || analysis.redFlags.length >= 1) {
                results.mediumRisk.push({ entity, analysis });
            } else {
                results.lowRisk.push({ entity, analysis });
            }
            
            results.allResults.push({ entity, analysis });
            
        } catch (error) {
            console.error(`[BATCH-ANALYSIS] Error for ${entity}: ${error.message}`);
        }
    }
    
    // Sort by risk
    results.highRisk.sort((a, b) => b.analysis.confidenceScore - a.analysis.confidenceScore);
    
    return results;
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    // Data Sources
    MN_SOURCES,
    
    // Search Functions
    searchMNCampaignFinance,
    searchMNLicensing,
    
    // Analysis Functions
    analyzeCCAPProvider,
    crossReferencePoliticalDonations,
    analyzeFraudPatterns,
    batchAnalyzeEntities,
    
    // Investigation Package
    generateMNInvestigationPackage,
    
    // Helper Functions
    generateCFBSearchLinks,
    generateLicensingSearchLinks,
    generateComprehensiveSearchLinks,
    
    // Fraud Patterns
    CCAP_FRAUD_PATTERNS
};
