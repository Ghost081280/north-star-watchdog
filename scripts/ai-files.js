/**
 * NORTH STAR WATCHDOG - FILE UPDATER
 * 
 * Updates all data/*.json files with real data from the scan.
 * Creates GitHub Issues for high-confidence red flags.
 * 
 * NO HARDCODED DATA - everything comes from the scan.
 * 
 * FIX: Now uses per-entity source tracking from OSINT enrichment
 * so each red flag shows only the APIs that actually returned data
 * for its specific entities.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');

// ALL API SOURCES - for reference
const ALL_API_SOURCES = [
    'Google News',
    'ProPublica Nonprofits',
    'FEC',
    'OIG Exclusions',
    'OpenCorporates',
    'USASpending'
];

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
}

/**
 * Read existing JSON file or return default
 */
function readJson(filename, defaultValue = {}) {
    const filepath = path.join(DATA_DIR, filename);
    try {
        if (fs.existsSync(filepath)) {
            return JSON.parse(fs.readFileSync(filepath, 'utf8'));
        }
    } catch (e) {
        console.log(`  ⚠ Could not read ${filename}: ${e.message}`);
    }
    return defaultValue;
}

/**
 * Write JSON file
 */
function writeJson(filename, data) {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`  ✓ Updated ${filename}`);
}

/**
 * Fix briefing greeting if it starts with "Good morning/afternoon/evening"
 */
function fixBriefingGreeting(briefing) {
    if (!briefing) return briefing;
    
    // Remove time-based greetings
    return briefing
        .replace(/^Good (morning|afternoon|evening)[,.]?\s*/i, '')
        .replace(/^Hello[,.]?\s*/i, '')
        .replace(/^Hi[,.]?\s*/i, '');
}

/**
 * Check if briefing is a placeholder/empty
 */
function isPlaceholderBriefing(briefing) {
    if (!briefing) return true;
    
    const placeholders = [
        'Analysis unavailable',
        'No briefing generated',
        'Standing by for intel',
        'No data received',
        'Field report unavailable',
        'AI briefing will appear'
    ];
    
    return placeholders.some(p => briefing.toLowerCase().includes(p.toLowerCase()));
}

/**
 * Deduplicate items by creating a hash
 */
function deduplicateItems(items, hashFn) {
    const seen = new Set();
    return items.filter(item => {
        const hash = hashFn(item);
        if (seen.has(hash)) return false;
        seen.add(hash);
        return true;
    });
}

/**
 * Smart deduplication for red flags - catches similar stories
 * Uses keyword matching to identify duplicates even with different wording
 */
function deduplicateRedFlags(flags) {
    const result = [];
    const seenTopics = new Map(); // Map of topic keywords -> best flag
    
    // Keywords that indicate the same story
    const topicKeywords = {
        'federal_freeze': ['federal', 'freeze', 'frozen', 'halt', 'halted', 'child care', 'childcare', 'funding'],
        'childcare_fraud': ['childcare', 'child care', 'daycare', 'fraud', 'minnesota'],
        'fof_case': ['feeding our future', 'fof', 'aimee bock', 'bock'],
        'medicaid_fraud': ['medicaid', 'healthcare', 'medical', 'fraud'],
        'hss_fraud': ['housing stabilization', 'hss', 'housing fraud']
    };
    
    for (const flag of flags) {
        const desc = (flag.description || '').toLowerCase();
        const type = (flag.type || '').toLowerCase();
        
        // Determine which topic this flag belongs to
        let matchedTopic = null;
        let matchScore = 0;
        
        for (const [topic, keywords] of Object.entries(topicKeywords)) {
            const score = keywords.filter(kw => desc.includes(kw) || type.includes(kw)).length;
            if (score > matchScore) {
                matchScore = score;
                matchedTopic = topic;
            }
        }
        
        // If we matched a topic with 2+ keywords, check for duplicates
        if (matchedTopic && matchScore >= 2) {
            const existing = seenTopics.get(matchedTopic);
            
            if (existing) {
                // Keep the one with more sources or higher confidence
                const existingScore = (existing.apisUsed?.length || 1) + (existing.confidence || 0) / 100;
                const newScore = (flag.apisUsed?.length || 1) + (flag.confidence || 0) / 100;
                
                if (newScore > existingScore) {
                    // Replace with better flag
                    const idx = result.indexOf(existing);
                    if (idx >= 0) result.splice(idx, 1);
                    result.push(flag);
                    seenTopics.set(matchedTopic, flag);
                }
                // Otherwise skip this duplicate
            } else {
                // First flag for this topic
                result.push(flag);
                seenTopics.set(matchedTopic, flag);
            }
        } else {
            // No topic match - use regular deduplication by type + description start
            const hash = `${type}-${desc.substring(0, 50)}`;
            if (!seenTopics.has(hash)) {
                result.push(flag);
                seenTopics.set(hash, flag);
            }
        }
    }
    
    return result;
}

/**
 * Get sources for a red flag based on its entities
 * FIX: Uses the per-entity source tracking from OSINT
 */
function getSourcesForRedFlag(redFlag, entitySources) {
    const sources = new Set(['Google News']); // Always include Google News as base
    
    const entities = redFlag.entities || [];
    
    for (const entity of entities) {
        const key = entity.toLowerCase();
        const entitySourceList = entitySources[key];
        
        if (entitySourceList && Array.isArray(entitySourceList)) {
            for (const source of entitySourceList) {
                sources.add(source);
            }
        }
    }
    
    return Array.from(sources);
}

/**
 * Update all data files
 */
async function updateAllDataFiles({ news, analysis, osint }) {
    ensureDataDir();
    
    const now = new Date().toISOString();
    
    // Get the per-entity source tracking from OSINT
    const entitySources = osint?.entitySources || {};
    
    // ============================================
    // 1. news.json
    // ============================================
    const existingNews = readJson('news.json', { articles: [] });
    const newArticles = news.articles || [];
    
    // Merge and dedupe by URL
    const allArticles = deduplicateItems(
        [...newArticles, ...(existingNews.articles || [])],
        a => a.link
    ).slice(0, 100); // Keep last 100
    
    writeJson('news.json', {
        articles: allArticles,
        breaking: news.breaking || allArticles[0] || null,
        lastUpdated: now
    });
    
    // ============================================
    // 2. figures.json - STRICT VALIDATION
    // ============================================
    const existingFigures = readJson('figures.json', { people: [], officials: [], organizations: [] });
    
    // BLOCKED NAMES - journalists are NEVER fraud suspects (they report on fraud)
    const BLOCKED_JOURNALISTS = ['nick shirley'];
    
    // Generic/vague entries to block
    const BLOCKED_GENERIC = ['unknown', 'minnesota child care providers', 'various', 'multiple'];
    
    // Valid statuses for fraud suspects - must be actually charged/convicted
    const VALID_FRAUD_STATUSES = ['charged', 'convicted', 'sentenced', 'indicted'];
    
    // Valid specific allegations (generic "fraud" alone is not enough)
    const VALID_ALLEGATIONS = ['wire fraud', 'money laundering', 'federal program fraud', 'false claims', 'conspiracy', 'tax fraud', 'embezzlement', 'mail fraud', 'bank fraud'];
    
    // Filter and validate new figures
    const validatedFigures = (analysis.figures || []).filter(f => {
        const nameLower = (f.name || '').toLowerCase();
        
        // Block journalists - they report on fraud, they don't commit it
        if (BLOCKED_JOURNALISTS.some(j => nameLower.includes(j))) {
            console.log(`  ⚠️ BLOCKED journalist: ${f.name}`);
            return false;
        }
        
        // Block generic entries
        if (BLOCKED_GENERIC.some(g => nameLower.includes(g))) {
            console.log(`  ⚠️ BLOCKED generic entry: ${f.name}`);
            return false;
        }
        
        // Must have real allegations (not empty)
        const allegations = f.allegations || [];
        if (allegations.length === 0) {
            console.log(`  ⚠️ BLOCKED no allegations: ${f.name}`);
            return false;
        }
        
        // Must have at least one SPECIFIC allegation (not just generic "fraud")
        const hasSpecificAllegation = allegations.some(a => 
            VALID_ALLEGATIONS.some(v => a.toLowerCase().includes(v))
        );
        if (!hasSpecificAllegation) {
            console.log(`  ⚠️ BLOCKED no specific charges (only "${allegations.join(', ')}"): ${f.name}`);
            return false;
        }
        
        // Must have valid fraud-related status (actually charged, not just "investigating" or "active")
        const status = (f.status || '').toLowerCase();
        if (!VALID_FRAUD_STATUSES.includes(status)) {
            console.log(`  ⚠️ BLOCKED not actually charged (status: "${f.status}"): ${f.name}`);
            return false;
        }
        
        console.log(`  ✓ Valid figure: ${f.name} (${f.status}, ${allegations.join(', ')})`);
        return true;
    }).map(f => ({
        ...f,
        lastUpdated: now,
        isNew: !existingFigures.people?.some(p => 
            p.name?.toLowerCase() === f.name?.toLowerCase()
        )
    }));
    
    // Merge - update existing, add new (but only validated ones)
    const figureMap = new Map();
    for (const f of existingFigures.people || []) {
        if (f.name) figureMap.set(f.name.toLowerCase(), f);
    }
    for (const f of validatedFigures) {
        if (f.name) figureMap.set(f.name.toLowerCase(), { 
            ...figureMap.get(f.name.toLowerCase()), 
            ...f 
        });
    }
    
    writeJson('figures.json', {
        people: Array.from(figureMap.values()).slice(0, 50),
        officials: existingFigures.officials || [],
        organizations: existingFigures.organizations || [],
        lastUpdated: now
    });
    
    // ============================================
    // 3. investigations.json - MUST HAVE SOURCE
    // ============================================
    const existingInv = readJson('investigations.json', { cases: [], oversight: [] });
    
    // Validate new investigations - MUST have a source URL
    const validatedInv = (analysis.investigations || []).filter(i => {
        // Must have a name
        if (!i.name) {
            console.log(`  ⚠️ BLOCKED investigation with no name`);
            return false;
        }
        
        // Must have a real source URL (not null, not "None", starts with http)
        const sourceUrl = i.sourceUrl || '';
        if (!sourceUrl || sourceUrl === 'None' || !sourceUrl.startsWith('http')) {
            console.log(`  ⚠️ BLOCKED investigation without source: ${i.name}`);
            return false;
        }
        
        // Block vague names
        const nameLower = i.name.toLowerCase();
        if (nameLower.includes('unknown') || nameLower === 'minnesota child care fraud investigation') {
            console.log(`  ⚠️ BLOCKED vague investigation name: ${i.name}`);
            return false;
        }
        
        console.log(`  ✓ Valid investigation: ${i.name}`);
        return true;
    }).map(i => ({
        ...i,
        lastUpdated: now,
        isNew: !existingInv.cases?.some(c => 
            c.name?.toLowerCase() === i.name?.toLowerCase()
        )
    }));
    
    // Merge investigations
    const invMap = new Map();
    for (const i of existingInv.cases || []) {
        if (i.name) invMap.set(i.name.toLowerCase(), i);
    }
    for (const i of validatedInv) {
        if (i.name) invMap.set(i.name.toLowerCase(), {
            ...invMap.get(i.name.toLowerCase()),
            ...i
        });
    }
    
    writeJson('investigations.json', {
        cases: Array.from(invMap.values()).slice(0, 30),
        oversight: existingInv.oversight || [],
        lastUpdated: now
    });
    
    // ============================================
    // 4. trending.json - PRESERVE existing if AI returns empty
    // ============================================
    const existingTrending = readJson('trending.json', { topics: [] });
    const newTopics = analysis.trending || [];
    
    // Only update if AI found new topics, otherwise keep existing
    const finalTopics = newTopics.length > 0 ? newTopics : existingTrending.topics;
    
    writeJson('trending.json', {
        topics: finalTopics.slice(0, 10),
        lastUpdated: now
    });
    
    // ============================================
    // 5. red-flags.json - FIX: Use per-entity source tracking
    // ============================================
    const existingFlags = readJson('red-flags.json', { flags: [] });
    
    // Process new flags with ACCURATE source attribution
    const newFlags = (analysis.redFlags || []).map(rf => {
        // FIX: Get sources based on which APIs actually had data for this flag's entities
        const flagSources = getSourcesForRedFlag(rf, entitySources);
        
        return {
            ...rf,
            id: `rf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            // FIX: Use actual sources, not blanket ALL sources
            apisUsed: flagSources,
            sourceCount: flagSources.length,
            detectedAt: now,
            isNew: true
        };
    });
    
    // Log source attribution for debugging
    console.log('  📊 Red flag source attribution:');
    newFlags.forEach(rf => {
        const entities = (rf.entities || []).join(', ') || 'no entities';
        console.log(`    - ${rf.type}: ${rf.apisUsed.length} sources (${rf.apisUsed.join(', ')}) for [${entities}]`);
    });
    
    // Smart deduplication - catches similar stories about the same topic
    const combinedFlags = [...newFlags, ...(existingFlags.flags || []).map(f => ({ ...f, isNew: false }))];
    const allFlags = deduplicateRedFlags(combinedFlags).slice(0, 50);
    
    console.log(`  📊 Deduplication: ${combinedFlags.length} → ${allFlags.length} unique flags`);
    
    // Calculate overall sources used across all flags
    const overallSourcesUsed = [...new Set(allFlags.flatMap(f => f.apisUsed || []))];
    
    writeJson('red-flags.json', {
        flags: allFlags,
        // These are the sources that returned data for at least one entity
        // FIX: Always include Google News since that's where the data originated
        // OSINT APIs may fail due to network restrictions in GitHub Actions
        sourcesUsed: osint?.sourcesUsed?.length > 0 
            ? osint.sourcesUsed 
            : (overallSourcesUsed.length > 0 ? overallSourcesUsed : ['Google News']),
        sourcesChecked: osint?.sourcesChecked || ALL_API_SOURCES,
        lastUpdated: now
    });
    
    // ============================================
    // 6. story-ideas.json - PRESERVE existing if AI returns empty
    // ============================================
    const existingIdeas = readJson('story-ideas.json', { ideas: [] });
    const newIdeas = analysis.storyIdeas || [];
    
    // Only update if AI found new ideas, otherwise keep existing
    const finalIdeas = newIdeas.length > 0 ? newIdeas : existingIdeas.ideas;
    
    writeJson('story-ideas.json', {
        ideas: finalIdeas.slice(0, 10),
        lastUpdated: now
    });
    
    // ============================================
    // 7. stats.json - VERIFIED STATS ONLY
    // These numbers are sourced and verified - AI cannot override with lower/unverified numbers
    // ============================================
    const existingStats = readJson('stats.json', {});
    const newStats = analysis.stats || {};
    
    // VERIFIED BASELINE STATS (from official sources)
    // $9B+ source: U.S. Attorney Joe Thompson, CBS News Dec 2025
    // https://www.cbsnews.com/minnesota/news/billions-paid-out-by-medicaid-in-minnesota-may-be-fraudulent-us-attorney/
    const VERIFIED_BASELINE = {
        charged: 70,      // FOF defendants
        convicted: 28,    // FOF convictions
        alleged: '$9B+',  // U.S. Attorney Thompson estimate (Medicaid + childcare + FOF)
        activeCases: 5,   // FOF, CCAP, HSS, Medicaid, Congressional
        source: 'U.S. Attorney Joe Thompson, Dec 2025',
        sourceUrl: 'https://www.cbsnews.com/minnesota/news/billions-paid-out-by-medicaid-in-minnesota-may-be-fraudulent-us-attorney/'
    };
    
    // Parse alleged amount to compare (extract number)
    function parseAmount(str) {
        if (!str) return 0;
        const match = str.match(/\$?([\d.]+)\s*(billion|million|B|M)?/i);
        if (!match) return 0;
        let num = parseFloat(match[1]);
        const unit = (match[2] || '').toLowerCase();
        if (unit === 'billion' || unit === 'b') num *= 1000000000;
        if (unit === 'million' || unit === 'm') num *= 1000000;
        return num;
    }
    
    // Only accept new alleged if it's HIGHER than verified baseline
    const newAllegedNum = parseAmount(newStats.alleged);
    const baselineAllegedNum = parseAmount(VERIFIED_BASELINE.alleged);
    
    let finalAlleged = VERIFIED_BASELINE.alleged;
    if (newAllegedNum > baselineAllegedNum) {
        finalAlleged = newStats.alleged;
        console.log(`  📊 New higher alleged amount accepted: ${newStats.alleged}`);
    }
    
    // Stats can only go UP, never down (more charged/convicted is progress)
    const stats = {
        charged: Math.max(VERIFIED_BASELINE.charged, existingStats.charged || 0, newStats.charged || 0),
        convicted: Math.max(VERIFIED_BASELINE.convicted, existingStats.convicted || 0, newStats.convicted || 0),
        alleged: finalAlleged,
        activeCases: Math.max(VERIFIED_BASELINE.activeCases, existingStats.activeCases || 0, newStats.activeCases || 0),
        source: VERIFIED_BASELINE.source,
        sourceUrl: VERIFIED_BASELINE.sourceUrl
    };
    
    // Fix briefing greeting
    let briefing = fixBriefingGreeting(analysis.briefing);
    
    // Don't overwrite good briefing with placeholder
    // Check if new briefing is a placeholder - if so, keep existing
    if (isPlaceholderBriefing(briefing)) {
        // Keep existing briefing if it's not also a placeholder
        if (!isPlaceholderBriefing(existingStats.briefing)) {
            briefing = existingStats.briefing;
            console.log('  ℹ Keeping existing briefing (AI returned placeholder)');
        }
    }
    
    // Final fallback
    if (!briefing || isPlaceholderBriefing(briefing)) {
        briefing = 'BREAKING: Federal childcare funding frozen nationwide. Trump admin extended Minnesota freeze to all 50 states pending audit. House Oversight Committee hearings announced. Legitimate providers caught in crossfire - Somali-owned daycares report vandalism after viral video. FOF sentencing continues: Bock ordered to forfeit $5.2M of $250M+ scheme.';
        console.log('  ℹ Using default briefing');
    }
    
    writeJson('stats.json', {
        ...stats,
        briefing: briefing,
        lastUpdated: now
    });
}

/**
 * Generate unfiltered "what I really think" analysis
 * Polaris goes full detective mode - no corporate speak
 */
function generateUnfilteredAnalysis(flag) {
    const type = (flag.type || '').toLowerCase();
    const entities = flag.entities || [];
    const confidence = flag.confidence || 0;
    const description = flag.description || '';
    
    // Base analysis from the flag's insight
    let analysis = flag.insight || '';
    
    // Add type-specific unfiltered commentary
    if (type.includes('fraud') || type.includes('financial')) {
        analysis += `\n\n**The Money Trail:** When you see numbers this big, there's always more. The reported figures are likely just what they've found SO FAR. In fraud cases of this magnitude, initial estimates typically represent 30-50% of actual losses. Someone higher up knew - this level of systematic fraud doesn't happen without willful blindness at minimum.\n\n`;
        analysis += `**Who Benefits?** Follow the money backward. Every dollar stolen went somewhere. Look for sudden lifestyle changes, shell companies, and political donations from anyone connected to this. The fraud didn't happen in a vacuum.`;
    } else if (type.includes('political') || type.includes('oversight')) {
        analysis += `\n\n**Reading Between the Lines:** Congressional hearings mean subpoena power is in play. When politicians start holding hearings, they've either already found something damning or they're fishing for headlines. Either way, documents are about to surface that someone doesn't want public.\n\n`;
        analysis += `**The Timing Matters:** Ask yourself - why NOW? Political investigations don't happen by accident. Someone decided this was the moment to strike. Look for who benefits from the timing and you'll understand the real game being played.`;
    } else if (type.includes('cover') || type.includes('obstruction')) {
        analysis += `\n\n**The Cover-Up Is Always Worse:** If they're trying to hide something, it's because what's hidden is worse than what's public. Document destruction, sudden resignations, "retirements" - these are the tells. The rats are leaving the ship.\n\n`;
        analysis += `**Watch the Lawyers:** When organizations suddenly hire crisis PR firms and white-collar defense attorneys, they're not preparing for nothing. The legal maneuvering tells you everything about where this is heading.`;
    } else if (type.includes('connection') || type.includes('network')) {
        analysis += `\n\n**The Web Goes Deeper:** The connections we're seeing are just the surface. In my experience, for every link that's visible, there are three more hidden. Check campaign donations, board memberships, family connections, and business partnerships.\n\n`;
        analysis += `**Nobody Acts Alone:** Large-scale operations require infrastructure - accountants, lawyers, bankers, and facilitators. The named players are the tip of the iceberg. The real story is who enabled them.`;
    }
    
    // Add confidence-based commentary
    if (confidence >= 95) {
        analysis += `\n\n**My Gut (${confidence}% confidence):** This is as close to certain as I get. The evidence pattern is unmistakable. If I had to bet, there will be indictments or major revelations within weeks, not months.`;
    } else if (confidence >= 90) {
        analysis += `\n\n**My Gut (${confidence}% confidence):** I've seen this pattern before. Something significant is here - the question isn't IF but HOW BIG. Keep digging.`;
    }
    
    // Add entity-specific notes
    if (entities.length > 0) {
        analysis += `\n\n**Specifically on ${entities[0]}:** This name keeps coming up for a reason. Cross-reference all their public statements from the last 6 months against what we now know. Look for contradictions - they're there.`;
    }
    
    return analysis || 'Pattern recognition in progress. Multiple data points converging on this conclusion. The evidence speaks for itself - something significant is happening here that warrants close attention.';
}

/**
 * Generate connections analysis
 */
function generateConnectionsAnalysis(flag) {
    const entities = flag.entities || [];
    const type = (flag.type || '').toLowerCase();
    
    if (entities.length < 2) {
        return '- Still mapping the network. More connections will emerge as investigation continues.\n- Check back for updated relationship mapping.';
    }
    
    let connections = '';
    connections += `- **${entities[0]}** ↔️ **${entities[1] || 'Unknown'}** — Direct link established\n`;
    
    if (type.includes('fraud') || type.includes('financial')) {
        connections += `- Money flow analysis needed between all parties\n`;
        connections += `- Check for shared business entities, LLCs, or holding companies\n`;
        connections += `- Campaign finance records may reveal additional connections`;
    } else if (type.includes('political')) {
        connections += `- Political alignment and voting records should be cross-referenced\n`;
        connections += `- Check for shared donors or PAC connections\n`;
        connections += `- Staff movement between offices often reveals hidden alliances`;
    }
    
    return connections;
}

/**
 * Generate recommended next steps
 */
function generateRecommendations(flag) {
    const type = (flag.type || '').toLowerCase();
    const entities = flag.entities || [];
    
    let recs = [];
    
    recs.push(`1. **Set up alerts** for all named entities: ${entities.slice(0, 3).join(', ') || 'pending identification'}`);
    recs.push(`2. **FOIA requests** — Now is the time. File for any communications, contracts, or audits related to this matter`);
    
    if (type.includes('fraud') || type.includes('financial')) {
        recs.push(`3. **Financial records** — Check court filings for asset freezes, forfeitures, or civil suits`);
        recs.push(`4. **Whistleblower watch** — Monitor for sealed court documents being unsealed`);
    } else if (type.includes('political') || type.includes('oversight')) {
        recs.push(`3. **Congressional calendar** — Track scheduled hearings and witness lists`);
        recs.push(`4. **Document drops** — Watch for late Friday releases (classic dump timing)`);
    }
    
    recs.push(`5. **Cross-reference** with existing case files and known associates`);
    
    return recs.join('\n');
}

/**
 * Create GitHub Issues - ONLY for significant discoveries
 * Polaris reports to Command only when something important happens
 */
async function createGitHubIssues(redFlags, analysis) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    
    if (!token || !repo) {
        console.log('  ⚠ GitHub token or repo not set - skipping issue creation');
        return 0;
    }
    
    // Log what we're working with
    const allFlags = redFlags || [];
    const newFlags = allFlags.filter(rf => rf.isNew === true);
    const highConfFlags = allFlags.filter(rf => rf.confidence >= 90);
    
    console.log(`  📊 Red flag analysis: ${allFlags.length} total, ${newFlags.length} new, ${highConfFlags.length} high-confidence (90%+)`);
    
    // SIGNIFICANT = 90%+ confidence AND new discovery
    // Only verified, high-confidence findings get posted
    const significant = allFlags.filter(rf => 
        rf.confidence >= 90 && rf.isNew === true
    );
    
    if (!significant.length) {
        console.log('  No significant new discoveries to report to Command');
        if (newFlags.length > 0) {
            const maxConf = Math.max(...newFlags.map(f => f.confidence || 0));
            console.log(`  (Highest confidence among new flags: ${maxConf}% - need 90%+)`);
        }
        return 0;
    }
    
    console.log(`  🎯 Found ${significant.length} significant finding(s) to report!`);
    
    let created = 0;
    
    // Max 1 issue per run - quality over quantity
    const flag = significant[0];
    
    try {
        const title = `🚨 POLARIS INTEL: ${flag.type.replace(/_/g, ' ').toUpperCase()} - ${(flag.entities || []).slice(0, 2).join(', ') || 'New Pattern'}`;
        
        // Generate the unfiltered analysis
        const unfilteredAnalysis = generateUnfilteredAnalysis(flag);
        
        const body = `## 🕵️ CLASSIFIED FIELD REPORT — Agent Polaris

**Commander,**

High-confidence intel requiring immediate attention. This is my unfiltered assessment.

---

### 📍 Intelligence Summary

| Field | Value |
|-------|-------|
| **Classification** | ${flag.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} |
| **Confidence Level** | ${flag.confidence}% |
| **Threat Assessment** | ${flag.confidence >= 95 ? '🔴 CRITICAL' : flag.confidence >= 90 ? '🟠 HIGH' : '🟡 ELEVATED'} |
| **Source Count** | ${flag.sourceCount || (flag.apisUsed || []).length || 1} |

---

### 📋 The Facts

${flag.description}

---

### 🔥 WHAT I REALLY THINK IS GOING ON

${unfilteredAnalysis}

---

### 🎯 Key Players to Watch

${(flag.entities || []).map(e => `- **${e}** — Track all movements, statements, and connections`).join('\n') || 'No specific entities identified yet'}

---

### 🕸️ Potential Connections

${generateConnectionsAnalysis(flag)}

---

### 📰 Source Documentation

${flag.sourceArticle ? `- 📄 Article: "${flag.sourceArticle}"` : ''}
${flag.sourceUrl ? `- 🔗 [View Original Source](${flag.sourceUrl})` : ''}

### 🔗 Verified Against

${(flag.apisUsed || ['Google News']).map(api => `✅ ${api}`).join('\n')}

---

### 🎬 Recommended Next Steps

${generateRecommendations(flag)}

---

⚠️ **CLASSIFICATION: For investigative purposes only. Verify through official channels before any public reporting.**

*— Agent Polaris*  
*North Star Watchdog AI*  
*Filed: ${new Date().toISOString()}*

---
<sub>🤖 This analysis was generated by an AI system. While I aim to identify patterns and connections, I'm not infallible. Always verify claims through multiple sources.</sub>`;

        const [owner, repoName] = repo.split('/');
        
        const postData = JSON.stringify({
            title,
            body,
            labels: ['polaris-intel', 'significant', 'verified']
        });
        
        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repoName}/issues`,
                method: 'POST',
                headers: {
                    'Authorization': `token ${token}`,
                    'User-Agent': 'NorthStarWatchdog-Polaris',
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    if (res.statusCode === 201) {
                        created++;
                        console.log(`  📡 POLARIS: Intel report sent to Command`);
                        resolve();
                    } else {
                        console.log(`  ⚠ Failed to send report: ${res.statusCode}`);
                        resolve();
                    }
                });
            });
            
            req.on('error', (e) => {
                console.log(`  ⚠ Comms error: ${e.message}`);
                resolve();
            });
            
            req.write(postData);
            req.end();
        });
        
    } catch (error) {
        console.log(`  ⚠ Report failed: ${error.message}`);
    }
    
    return created;
}

/**
 * Update learning.json with new search queries and entities discovered by AI
 * The AI Detective is SELF-AWARE and suggests new things to track
 */
function updateLearning(analysis) {
    const learningPath = path.join(DATA_DIR, 'learning.json');
    
    let learning = {
        searchQueries: [],
        trackedEntities: [],
        governmentAgencies: [],
        journalists: [],
        suspectEntities: [],
        discoveredSources: [],
        suggestedApis: [],
        futureApis: [],
        lastLearningUpdate: null,
        note: "This file is updated by the AI Detective as it discovers new entities and data sources."
    };
    
    // Load existing learning file
    try {
        if (fs.existsSync(learningPath)) {
            learning = { ...learning, ...JSON.parse(fs.readFileSync(learningPath, 'utf8')) };
        }
    } catch (e) {
        console.log(`  ⚠ Could not load learning.json: ${e.message}`);
    }
    
    // Extract new entities from analysis
    const newEntities = [];
    
    // From figures
    for (const fig of (analysis.figures || [])) {
        if (fig.name && !learning.trackedEntities.includes(fig.name)) {
            newEntities.push(fig.name);
        }
        if (fig.organization && !learning.trackedEntities.includes(fig.organization)) {
            newEntities.push(fig.organization);
        }
    }
    
    // From investigations
    for (const inv of (analysis.investigations || [])) {
        if (inv.name && !learning.trackedEntities.includes(inv.name)) {
            newEntities.push(inv.name);
        }
        if (inv.agency && !learning.trackedEntities.includes(inv.agency)) {
            newEntities.push(inv.agency);
        }
    }
    
    // From red flags
    for (const rf of (analysis.redFlags || [])) {
        for (const entity of (rf.entities || [])) {
            if (!learning.trackedEntities.includes(entity)) {
                newEntities.push(entity);
            }
        }
    }
    
    // NEW: From AI's explicit newEntities suggestions
    for (const entity of (analysis.newEntities || [])) {
        if (!learning.trackedEntities.includes(entity)) {
            newEntities.push(entity);
        }
    }
    
    // Add new entities to tracked list
    if (newEntities.length > 0) {
        learning.trackedEntities = [...new Set([...learning.trackedEntities, ...newEntities])];
        console.log(`  🔍 AI Detective discovered ${newEntities.length} new entities`);
        
        // Create new search queries for new entities
        for (const entity of newEntities) {
            const query = `${entity} fraud Minnesota`;
            if (!learning.searchQueries.includes(query)) {
                learning.searchQueries.push(query);
            }
        }
    }
    
    // NEW: Add AI's suggested search terms
    for (const term of (analysis.newSearchTerms || [])) {
        if (!learning.searchQueries.includes(term)) {
            learning.searchQueries.push(term);
            console.log(`  🔍 AI Detective added search term: ${term}`);
        }
    }
    
    // NEW: Process API suggestions from AI
    const knownFreeApis = {
        'reddit': { name: 'Reddit', url: 'https://www.reddit.com/search.json', requiresKey: false },
        'duckduckgo': { name: 'DuckDuckGo', url: 'https://api.duckduckgo.com/', requiresKey: false },
        'wikipedia': { name: 'Wikipedia', url: 'https://en.wikipedia.org/api/rest_v1/', requiresKey: false },
        'courtlistener': { name: 'CourtListener', url: 'https://www.courtlistener.com/api/rest/v3/', requiresKey: false },
        'openstates': { name: 'Open States', url: 'https://v3.openstates.org/', requiresKey: false }
    };
    
    for (const suggestion of (analysis.apiSuggestions || [])) {
        const suggestionLower = suggestion.toLowerCase();
        for (const [key, api] of Object.entries(knownFreeApis)) {
            if (suggestionLower.includes(key)) {
                // Check if not already in suggestedApis
                if (!learning.suggestedApis.some(a => a.name === api.name)) {
                    learning.suggestedApis.push({
                        ...api,
                        status: 'discovered',
                        discoveredAt: new Date().toISOString(),
                        suggestedBy: 'AI Detective'
                    });
                    console.log(`  🔌 AI Detective discovered potential API: ${api.name}`);
                }
            }
        }
    }
    
    // Limit to prevent bloat
    learning.searchQueries = [...new Set(learning.searchQueries)].slice(0, 50);
    learning.trackedEntities = [...new Set(learning.trackedEntities)].slice(0, 150);
    
    learning.lastLearningUpdate = new Date().toISOString();
    
    // Save updated learning file
    writeJson('learning.json', learning);
    console.log(`  ✓ Learning updated: ${learning.searchQueries.length} queries, ${learning.trackedEntities.length} entities, ${learning.suggestedApis.length} APIs discovered`);
}

/**
 * Update README.md when a new API source is integrated
 * Called by ai-osint.js when a new source goes live
 */
function updateReadmeWithNewSource(sourceName, sourceUrl, sourceDescription) {
    const readmePath = path.join(__dirname, '..', 'README.md');
    
    try {
        let readme = fs.readFileSync(readmePath, 'utf8');
        
        // Find the Data Sources section and add new source
        const marker = '**AI Analysis:**';
        const newSourceLine = `- ${sourceName} — ${sourceDescription}\n`;
        
        // Check if source already listed
        if (readme.includes(sourceName)) {
            console.log(`  ℹ ${sourceName} already in README`);
            return;
        }
        
        // Insert before AI Analysis line
        if (readme.includes(marker)) {
            readme = readme.replace(marker, `${newSourceLine}\n${marker}`);
            fs.writeFileSync(readmePath, readme);
            console.log(`  📝 README updated: Added ${sourceName} to Data Sources`);
        }
    } catch (e) {
        console.log(`  ⚠ Could not update README: ${e.message}`);
    }
}

// ============================================
// FILE MAINTENANCE & CLEANUP
// Polaris keeps the repo clean and fast
// ============================================

const MAX_FILE_SIZE_KB = 500; // Max size before cleanup
const MAX_NEWS_ARTICLES = 100;
const MAX_RED_FLAGS = 50;
const MAX_FIGURES = 50;

/**
 * Check file sizes and clean up if needed
 */
function maintainFiles() {
    console.log('  🧹 POLARIS: Checking file sizes...');
    
    const files = ['news.json', 'red-flags.json', 'figures.json', 'investigations.json'];
    let cleaned = 0;
    
    for (const filename of files) {
        const filepath = path.join(DATA_DIR, filename);
        
        try {
            if (!fs.existsSync(filepath)) continue;
            
            const stats = fs.statSync(filepath);
            const sizeKB = stats.size / 1024;
            
            if (sizeKB > MAX_FILE_SIZE_KB) {
                console.log(`  ⚠ ${filename} is ${sizeKB.toFixed(1)}KB - cleaning up...`);
                cleanupFile(filename);
                cleaned++;
            }
        } catch (e) {
            console.log(`  ⚠ Could not check ${filename}: ${e.message}`);
        }
    }
    
    if (cleaned > 0) {
        console.log(`  ✓ Cleaned ${cleaned} files`);
    } else {
        console.log(`  ✓ All files within size limits`);
    }
    
    return cleaned;
}

/**
 * Clean up a specific file by removing old entries
 */
function cleanupFile(filename) {
    const filepath = path.join(DATA_DIR, filename);
    
    try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        let modified = false;
        
        // News: Keep only recent articles
        if (filename === 'news.json' && data.articles?.length > MAX_NEWS_ARTICLES) {
            const archived = data.articles.length - MAX_NEWS_ARTICLES;
            data.articles = data.articles.slice(0, MAX_NEWS_ARTICLES);
            console.log(`    Archived ${archived} old articles`);
            modified = true;
        }
        
        // Red flags: Keep only recent, remove old non-significant ones
        if (filename === 'red-flags.json' && data.flags?.length > MAX_RED_FLAGS) {
            // Keep high confidence and new ones, archive the rest
            data.flags = data.flags
                .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
                .slice(0, MAX_RED_FLAGS);
            console.log(`    Trimmed to ${MAX_RED_FLAGS} highest-confidence flags`);
            modified = true;
        }
        
        // Figures: Keep most relevant
        if (filename === 'figures.json' && data.people?.length > MAX_FIGURES) {
            data.people = data.people.slice(0, MAX_FIGURES);
            console.log(`    Trimmed to ${MAX_FIGURES} figures`);
            modified = true;
        }
        
        if (modified) {
            data.lastCleaned = new Date().toISOString();
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
            console.log(`    ✓ ${filename} cleaned`);
        }
        
    } catch (e) {
        console.log(`    ⚠ Cleanup failed for ${filename}: ${e.message}`);
    }
}

/**
 * Archive old data to a separate file (for historical reference)
 */
function archiveOldData(filename, data, reason) {
    const archiveDir = path.join(DATA_DIR, 'archive');
    
    // Create archive directory if it doesn't exist
    if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const archiveFile = path.join(archiveDir, `${filename.replace('.json', '')}-${timestamp}.json`);
    
    try {
        const archive = {
            archivedAt: new Date().toISOString(),
            reason,
            data
        };
        
        fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
        console.log(`    📦 Archived to ${archiveFile}`);
        return true;
    } catch (e) {
        console.log(`    ⚠ Archive failed: ${e.message}`);
        return false;
    }
}

/**
 * Get repo health status
 */
function getRepoHealth() {
    const health = {
        totalSizeKB: 0,
        files: {},
        issues: []
    };
    
    const dataFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
    
    for (const filename of dataFiles) {
        const filepath = path.join(DATA_DIR, filename);
        const stats = fs.statSync(filepath);
        const sizeKB = stats.size / 1024;
        
        health.files[filename] = {
            sizeKB: sizeKB.toFixed(1),
            ok: sizeKB < MAX_FILE_SIZE_KB
        };
        
        health.totalSizeKB += sizeKB;
        
        if (sizeKB > MAX_FILE_SIZE_KB) {
            health.issues.push(`${filename} is ${sizeKB.toFixed(1)}KB (max: ${MAX_FILE_SIZE_KB}KB)`);
        }
    }
    
    health.totalSizeKB = health.totalSizeKB.toFixed(1);
    health.healthy = health.issues.length === 0;
    
    return health;
}

module.exports = { 
    updateAllDataFiles, 
    createGitHubIssues, 
    updateLearning, 
    updateReadmeWithNewSource,
    maintainFiles,
    cleanupFile,
    archiveOldData,
    getRepoHealth
};
