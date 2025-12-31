/**
 * NORTH STAR WATCHDOG - AI DETECTIVE
 * Pattern detection, cross-referencing, and "beyond the news" analysis
 */

const fs = require('fs');
const analyzer = require('./ai-analyzer');

/**
 * Pattern types we look for
 */
const PATTERN_TYPES = {
    SAME_ADDRESS: 'same_address_multiple_orgs',
    RAPID_LLC_FORMATION: 'llc_formed_before_billing',
    EXPLOSIVE_GROWTH: 'explosive_billing_growth',
    FOF_CONNECTION: 'feeding_our_future_connection',
    EXCLUDED_PROVIDER: 'excluded_provider_still_paid',
    LICENSE_REVOKED: 'license_revoked_still_billing',
    MULTI_PROGRAM: 'multi_program_fraud',
    PROPERTY_PURCHASE: 'property_purchase_after_payment',
    POLITICAL_CONNECTION: 'political_figure_connection',
    OUT_OF_STATE: 'out_of_state_fraud_tourist'
};

/**
 * Load historical data for pattern matching
 */
function loadHistoricalData() {
    const load = (file) => {
        try {
            return JSON.parse(fs.readFileSync(`data/${file}`, 'utf8'));
        } catch {
            return null;
        }
    };
    
    return {
        figures: load('figures.json'),
        investigations: load('investigations.json'),
        redFlags: load('red-flags.json'),
        highRiskPrograms: load('high-risk-programs.json')
    };
}

/**
 * Extract entities from articles for cross-referencing
 */
function extractEntities(articles) {
    const entities = {
        people: new Set(),
        organizations: new Set(),
        addresses: new Set(),
        amounts: new Set()
    };
    
    // Common patterns
    const patterns = {
        money: /\$[\d,]+(?:\.\d{2})?(?:\s*(?:million|billion|M|B))?/gi,
        // Names that appear before common titles
        names: /([A-Z][a-z]+ [A-Z][a-z]+)(?=,?\s*(?:CEO|founder|owner|director|manager|charged|convicted|arrested|indicted))/g
    };
    
    for (const article of articles) {
        const text = article.title;
        
        // Extract money amounts
        const amounts = text.match(patterns.money) || [];
        amounts.forEach(a => entities.amounts.add(a));
        
        // Extract names near titles
        const names = text.match(patterns.names) || [];
        names.forEach(n => entities.people.add(n));
    }
    
    return {
        people: [...entities.people],
        organizations: [...entities.organizations],
        addresses: [...entities.addresses],
        amounts: [...entities.amounts]
    };
}

/**
 * Check for connections between entities
 */
function findConnections(entities, historicalData) {
    const connections = [];
    
    // Check if any extracted names match known figures
    if (historicalData.figures?.people) {
        for (const name of entities.people) {
            const match = historicalData.figures.people.find(p => 
                p.name.toLowerCase().includes(name.toLowerCase()) ||
                name.toLowerCase().includes(p.name.toLowerCase())
            );
            if (match) {
                connections.push({
                    type: 'known_figure',
                    entity: name,
                    match: match.name,
                    status: match.status
                });
            }
        }
    }
    
    return connections;
}

/**
 * Detect suspicious patterns in the data
 */
async function detectPatterns(articles, aiAnalysis, historicalData) {
    const patterns = [];
    
    // Pattern: Multiple mentions of same entity across different sources
    const entityMentions = {};
    for (const article of articles) {
        const title = article.title.toLowerCase();
        
        // Count mentions of known investigation names
        if (historicalData.investigations?.cases) {
            for (const inv of historicalData.investigations.cases) {
                const invName = inv.name.toLowerCase();
                if (title.includes(invName.split(' ')[0])) {
                    entityMentions[inv.name] = (entityMentions[inv.name] || 0) + 1;
                }
            }
        }
    }
    
    // Flag entities with unusual spike in coverage
    for (const [entity, count] of Object.entries(entityMentions)) {
        if (count >= 5) {
            patterns.push({
                type: 'coverage_spike',
                entities: [entity],
                count,
                description: `"${entity}" mentioned in ${count} articles - unusual activity`,
                priority: count >= 8 ? 'high' : 'medium'
            });
        }
    }
    
    // Pattern: New red flags from AI analysis
    if (aiAnalysis?.redFlags) {
        for (const flag of aiAnalysis.redFlags) {
            patterns.push({
                type: flag.type,
                description: flag.description,
                entities: flag.entities,
                sourceUrl: flag.sourceUrl,
                priority: flag.priority || 'medium',
                recommendation: getRecommendation(flag.type)
            });
        }
    }
    
    // Pattern: Cross-reference with known bad actors
    if (aiAnalysis?.figureUpdates) {
        for (const update of aiAnalysis.figureUpdates) {
            if (update.status === 'charged' || update.status === 'convicted') {
                // Check if this person is connected to other entities
                const relatedArticles = articles.filter(a => 
                    a.title.toLowerCase().includes(update.name.toLowerCase().split(' ')[0])
                );
                
                if (relatedArticles.length > 1) {
                    patterns.push({
                        type: PATTERN_TYPES.POLITICAL_CONNECTION,
                        description: `${update.name} (${update.status}) appearing in ${relatedArticles.length} articles`,
                        entities: [update.name],
                        priority: 'medium',
                        recommendation: 'Review all mentions for additional connections'
                    });
                }
            }
        }
    }
    
    return patterns;
}

/**
 * Get recommendation based on pattern type
 */
function getRecommendation(patternType) {
    const recommendations = {
        [PATTERN_TYPES.SAME_ADDRESS]: 'Cross-reference address with MN Secretary of State filings',
        [PATTERN_TYPES.RAPID_LLC_FORMATION]: 'Check LLC formation dates against billing start dates',
        [PATTERN_TYPES.EXPLOSIVE_GROWTH]: 'Compare billing growth to industry averages',
        [PATTERN_TYPES.FOF_CONNECTION]: 'Review all FOF co-defendants and their other businesses',
        [PATTERN_TYPES.EXCLUDED_PROVIDER]: 'Check OIG and SAM.gov exclusion lists',
        [PATTERN_TYPES.LICENSE_REVOKED]: 'Verify against MN DHS licensing database',
        [PATTERN_TYPES.MULTI_PROGRAM]: 'Search USASpending for grants across multiple programs',
        [PATTERN_TYPES.PROPERTY_PURCHASE]: 'Check county property records for timing',
        [PATTERN_TYPES.POLITICAL_CONNECTION]: 'Review campaign finance records on FEC',
        [PATTERN_TYPES.OUT_OF_STATE]: 'Check if entity exists in other states'
    };
    
    return recommendations[patternType] || 'Manual review recommended';
}

/**
 * Main pattern analysis function
 */
async function analyzePatterns(articles, aiAnalysis) {
    console.log('  Running pattern detection...');
    
    const historicalData = loadHistoricalData();
    const entities = extractEntities(articles);
    const connections = findConnections(entities, historicalData);
    const suspiciousPatterns = await detectPatterns(articles, aiAnalysis, historicalData);
    
    console.log(`  Found ${suspiciousPatterns.length} patterns, ${connections.length} connections`);
    
    return {
        entities,
        connections,
        suspiciousPatterns,
        timestamp: new Date().toISOString()
    };
}

/**
 * Deep dive on a specific entity
 */
async function investigateEntity(entityName, articles) {
    // Get all articles mentioning this entity
    const relevantArticles = articles.filter(a => 
        a.title.toLowerCase().includes(entityName.toLowerCase())
    );
    
    // Ask AI for deeper analysis
    const context = relevantArticles.map(a => a.title).join('\n');
    const analysis = await analyzer.analyzeEntity(entityName, context);
    
    return {
        entity: entityName,
        articleCount: relevantArticles.length,
        sources: [...new Set(relevantArticles.map(a => a.source))],
        analysis,
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    analyzePatterns,
    investigateEntity,
    extractEntities,
    findConnections,
    PATTERN_TYPES
};
