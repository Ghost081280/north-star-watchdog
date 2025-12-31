/**
 * NORTH STAR WATCHDOG - FILE UPDATER
 * 
 * Updates all data/*.json files with real data from the scan.
 * Creates GitHub Issues for high-confidence red flags.
 * 
 * NO HARDCODED DATA - everything comes from the scan.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');

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
 * Update all data files
 */
async function updateAllDataFiles({ news, analysis, osint }) {
    ensureDataDir();
    
    const now = new Date().toISOString();
    
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
    // 2. figures.json
    // ============================================
    const existingFigures = readJson('figures.json', { people: [] });
    const newFigures = (analysis.figures || []).map(f => ({
        ...f,
        lastUpdated: now,
        isNew: !existingFigures.people?.some(p => 
            p.name?.toLowerCase() === f.name?.toLowerCase()
        )
    }));
    
    // Merge - update existing, add new
    const figureMap = new Map();
    for (const f of existingFigures.people || []) {
        if (f.name) figureMap.set(f.name.toLowerCase(), f);
    }
    for (const f of newFigures) {
        if (f.name) figureMap.set(f.name.toLowerCase(), { 
            ...figureMap.get(f.name.toLowerCase()), 
            ...f 
        });
    }
    
    writeJson('figures.json', {
        people: Array.from(figureMap.values()).slice(0, 50),
        lastUpdated: now
    });
    
    // ============================================
    // 3. investigations.json
    // ============================================
    const existingInv = readJson('investigations.json', { cases: [] });
    const newInv = (analysis.investigations || []).map(i => ({
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
    for (const i of newInv) {
        if (i.name) invMap.set(i.name.toLowerCase(), {
            ...invMap.get(i.name.toLowerCase()),
            ...i
        });
    }
    
    writeJson('investigations.json', {
        cases: Array.from(invMap.values()).slice(0, 30),
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
    // 5. red-flags.json
    // ============================================
    const existingFlags = readJson('red-flags.json', { flags: [] });
    const newFlags = (analysis.redFlags || []).map(rf => ({
        ...rf,
        id: `rf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        detectedAt: now,
        isNew: true
    }));
    
    // Dedupe by type + first 100 chars of description
    const allFlags = deduplicateItems(
        [...newFlags, ...(existingFlags.flags || []).map(f => ({ ...f, isNew: false }))],
        f => `${f.type}-${(f.description || '').substring(0, 100)}`
    ).slice(0, 50);
    
    // Mark which sources actually returned data
    const sourcesUsed = [
        'Google News', // Always used since we scraped it
        ...(osint.sourcesUsed || [])
    ];
    
    writeJson('red-flags.json', {
        flags: allFlags,
        sourcesUsed,
        sourcesChecked: ['Google News', ...(osint.sourcesChecked || [])],
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
    // 7. stats.json
    // ============================================
    const existingStats = readJson('stats.json', {});
    const newStats = analysis.stats || {};
    
    // Only update stats if AI provided them and they're higher
    const stats = {
        charged: Math.max(existingStats.charged || 0, newStats.charged || 0),
        convicted: Math.max(existingStats.convicted || 0, newStats.convicted || 0),
        alleged: newStats.alleged || existingStats.alleged || '$0',
        activeCases: newStats.activeCases || existingStats.activeCases || 0
    };
    
    // Fix briefing greeting
    let briefing = fixBriefingGreeting(analysis.briefing);
    
    // Don't overwrite good briefing with placeholder
    if (!briefing || briefing === 'Analysis unavailable - no data to process.' || briefing === 'No briefing generated.') {
        briefing = existingStats.briefing;
    }
    
    writeJson('stats.json', {
        ...stats,
        briefing: briefing || 'AI briefing will appear after first successful scan.',
        lastUpdated: now
    });
}

/**
 * Create GitHub Issues for high-confidence red flags
 */
async function createGitHubIssues(redFlags) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    
    if (!token || !repo) {
        console.log('  ⚠ GitHub token or repo not set - skipping issue creation');
        return 0;
    }
    
    // Only create issues for high-confidence flags
    const highConfidence = (redFlags || []).filter(rf => 
        rf.confidence >= 75 && rf.isNew !== false
    );
    
    if (!highConfidence.length) {
        console.log('  No high-confidence new flags to create issues for');
        return 0;
    }
    
    let created = 0;
    
    for (const flag of highConfidence.slice(0, 3)) { // Max 3 issues per run
        try {
            const title = `🚩 ${flag.type}: ${(flag.entities || []).join(', ') || 'Unknown Entity'}`;
            const body = `## Red Flag Detected

**Type:** ${flag.type}
**Confidence:** ${flag.confidence}%
**Source:** ${flag.source || 'AI Analysis'}

### Description
${flag.description}

### Entities Involved
${(flag.entities || []).map(e => `- ${e}`).join('\n') || 'No specific entities identified'}

### Source Article
${flag.sourceArticle || 'Not specified'}
${flag.sourceUrl ? `\n[View Source](${flag.sourceUrl})` : ''}

---
*Detected by North Star Watchdog AI on ${new Date().toISOString()}*
*This is an automated detection - please verify before taking action*`;

            const [owner, repoName] = repo.split('/');
            
            const postData = JSON.stringify({
                title,
                body,
                labels: ['ai-detected', flag.confidence >= 90 ? 'high-priority' : 'needs-verification']
            });
            
            await new Promise((resolve, reject) => {
                const req = https.request({
                    hostname: 'api.github.com',
                    path: `/repos/${owner}/${repoName}/issues`,
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${token}`,
                        'User-Agent': 'NorthStarWatchdog',
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        if (res.statusCode === 201) {
                            created++;
                            console.log(`  ✓ Created issue: ${title.substring(0, 50)}...`);
                            resolve();
                        } else {
                            console.log(`  ⚠ Failed to create issue: ${res.statusCode}`);
                            resolve();
                        }
                    });
                });
                
                req.on('error', (e) => {
                    console.log(`  ⚠ Issue creation error: ${e.message}`);
                    resolve();
                });
                
                req.write(postData);
                req.end();
            });
            
            // Rate limit
            await new Promise(r => setTimeout(r, 1000));
            
        } catch (error) {
            console.log(`  ⚠ Issue creation failed: ${error.message}`);
        }
    }
    
    return created;
}

/**
 * Update learning.json with new search queries and entities discovered by AI
 */
function updateLearning(analysis) {
    const learningPath = path.join(DATA_DIR, 'learning.json');
    
    let learning = {
        searchQueries: [],
        trackedEntities: [],
        discoveredSources: [],
        suggestedApis: []
    };
    
    // Load existing learning file
    try {
        if (fs.existsSync(learningPath)) {
            learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
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
    }
    
    // From red flags
    for (const rf of (analysis.redFlags || [])) {
        for (const entity of (rf.entities || [])) {
            if (!learning.trackedEntities.includes(entity)) {
                newEntities.push(entity);
            }
        }
    }
    
    // Add new entities to tracked list
    if (newEntities.length > 0) {
        learning.trackedEntities = [...new Set([...learning.trackedEntities, ...newEntities])];
        console.log(`  ✓ Added ${newEntities.length} new entities to track`);
        
        // Create new search queries for new entities
        for (const entity of newEntities) {
            const query = `${entity} fraud`;
            if (!learning.searchQueries.includes(query)) {
                learning.searchQueries.push(query);
            }
        }
    }
    
    // Limit search queries to prevent bloat
    learning.searchQueries = learning.searchQueries.slice(0, 30);
    learning.trackedEntities = learning.trackedEntities.slice(0, 100);
    
    learning.lastLearningUpdate = new Date().toISOString();
    
    // Save updated learning file
    writeJson('learning.json', learning);
    console.log(`  ✓ Learning file updated (${learning.searchQueries.length} queries, ${learning.trackedEntities.length} entities)`);
}

module.exports = { updateAllDataFiles, createGitHubIssues, updateLearning };
