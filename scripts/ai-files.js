/**
 * NORTH STAR WATCHDOG - AI FILES
 * Handles all file operations and GitHub Issues communication
 * 
 * FIXES APPLIED:
 * - Improved red flag deduplication (normalizes text before comparison)
 * - URL validation for all saved URLs
 * - Briefing greeting fix verified
 */

const fs = require('fs');
const https = require('https');
const http = require('http');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'Ghost081280/north-star-watchdog';

// ============================================
// BRIEFING GREETING FIX
// ============================================

function fixBriefingGreeting(briefing) {
    if (!briefing || typeof briefing !== 'string') {
        return getCorrectGreeting() + ' The AI is analyzing the latest developments.';
    }
    
    const correctGreeting = getCorrectGreeting();
    
    // Remove any existing greeting
    let fixed = briefing
        .replace(/^Good morning\.?\s*!?\s*☀️?\s*/i, '')
        .replace(/^Good afternoon\.?\s*!?\s*👋?\s*/i, '')
        .replace(/^Good evening\.?\s*!?\s*🌙?\s*/i, '')
        .replace(/^Good night\.?\s*!?\s*🌙?\s*/i, '')
        .trim();
    
    if (!fixed || fixed.length < 10) {
        fixed = 'The AI is analyzing the latest developments in Minnesota fraud investigations.';
    }
    
    return correctGreeting + ' ' + fixed;
}

function getCorrectGreeting() {
    const now = new Date();
    const cstOffset = -6 * 60;
    const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    let cstMinutes = utcMinutes + cstOffset;
    if (cstMinutes < 0) cstMinutes += 24 * 60;
    const cstHour = Math.floor(cstMinutes / 60) % 24;
    
    if (cstHour >= 5 && cstHour < 12) {
        return 'Good morning! ☀️';
    } else if (cstHour >= 12 && cstHour < 17) {
        return 'Good afternoon! 👋';
    } else {
        return 'Good evening! 🌙';
    }
}

// ============================================
// URL VALIDATION
// ============================================

async function validateUrl(url, entityName) {
    if (!url || typeof url !== 'string') {
        return createFallbackUrl(entityName);
    }
    
    // Check for malformed URLs
    if (url.includes('undefined') || url.includes('null')) {
        console.log(`    URL validation: Malformed URL for ${entityName}`);
        return createFallbackUrl(entityName);
    }
    
    // Check for non-ASCII characters (like Hindi)
    if (/[^\x00-\x7F]/.test(url)) {
        console.log(`    URL validation: Non-ASCII characters in URL for ${entityName}`);
        return createFallbackUrl(entityName);
    }
    
    // Basic URL format check
    try {
        new URL(url);
    } catch {
        console.log(`    URL validation: Invalid URL format for ${entityName}`);
        return createFallbackUrl(entityName);
    }
    
    // Skip reachability check to speed up processing, just return URL
    return url;
}

function createFallbackUrl(entityName) {
    if (!entityName) {
        return 'https://www.justice.gov/usao-mn';
    }
    return `https://news.google.com/search?q=${encodeURIComponent(entityName + ' Minnesota fraud')}`;
}

// ============================================
// FILE OPERATIONS
// ============================================

function loadData(filename) {
    try {
        return JSON.parse(fs.readFileSync(`data/${filename}`, 'utf8'));
    } catch {
        return null;
    }
}

function saveData(filename, data) {
    fs.writeFileSync(`data/${filename}`, JSON.stringify(data, null, 2));
    console.log(`    Saved ${filename}`);
}

// ============================================
// GITHUB ISSUES
// ============================================

async function createGitHubIssue({ title, body, labels = [] }) {
    if (!GITHUB_TOKEN) {
        console.log(`    [ISSUE] ${title}`);
        console.log(`    (No GITHUB_TOKEN - issue not created)`);
        return null;
    }
    
    const [owner, repo] = GITHUB_REPO.split('/');
    
    return new Promise((resolve) => {
        const data = JSON.stringify({
            title: `[AI] ${title}`,
            body: `${body}\n\n---\n*This issue was automatically created by the AI Updater at ${new Date().toISOString()}*`,
            labels: ['ai-request', ...labels]
        });
        
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/issues`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'NorthStarWatchdog-AI',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(body);
                    if (result.number) {
                        console.log(`    Created issue #${result.number}: ${title}`);
                        resolve(result);
                    } else {
                        console.log(`    Failed to create issue: ${body.substring(0, 100)}`);
                        resolve(null);
                    }
                } catch {
                    resolve(null);
                }
            });
        });
        
        req.on('error', () => resolve(null));
        req.write(data);
        req.end();
    });
}

async function checkApprovedIssues() {
    if (!GITHUB_TOKEN) return [];
    
    const [owner, repo] = GITHUB_REPO.split('/');
    
    return new Promise((resolve) => {
        const options = {
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/issues?labels=needs-approval&state=open`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'NorthStarWatchdog-AI',
                'Accept': 'application/vnd.github.v3+json'
            }
        };
        
        https.get(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const issues = JSON.parse(body);
                    resolve(Array.isArray(issues) ? issues : []);
                } catch {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

// ============================================
// IMPROVED RED FLAG DEDUPLICATION
// ============================================

/**
 * Normalize text for deduplication
 * - Lowercase
 * - Remove special characters
 * - Extract key words
 * - Sort alphabetically
 */
function normalizeForDedup(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3) // Only words with 4+ chars
        .sort()
        .join('');
}

/**
 * Create hash for deduplication - IMPROVED
 * Uses normalized type + normalized key words from description
 */
function createFlagHash(flag) {
    const normType = normalizeForDedup(flag.type || '');
    const normDesc = normalizeForDedup(flag.description || '');
    
    // Also include sorted entity names
    const normEntities = (flag.entities || [])
        .map(e => normalizeForDedup(e))
        .sort()
        .join('');
    
    const key = `${normType}-${normDesc.substring(0, 50)}-${normEntities.substring(0, 30)}`;
    
    // Simple hash
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

/**
 * Deduplicate red flags array - IMPROVED
 * More aggressive deduplication based on normalized content
 */
function deduplicateFlags(flags) {
    const seen = new Set();
    const seenDescriptions = new Set();
    
    return flags.filter(flag => {
        // Method 1: Hash-based dedup
        const hash = createFlagHash(flag);
        if (seen.has(hash)) {
            return false;
        }
        seen.add(hash);
        
        // Method 2: Normalized description similarity
        const normDesc = normalizeForDedup(flag.description || '').substring(0, 60);
        if (seenDescriptions.has(normDesc)) {
            return false;
        }
        seenDescriptions.add(normDesc);
        
        return true;
    });
}

// ============================================
// DATA FILE UPDATERS
// ============================================

async function updateAllDataFiles(articles, aiAnalysis, detectiveFindings, osintResults) {
    const timestamp = new Date().toISOString();
    
    // 1. Update news.json
    console.log('  Updating news.json...');
    const newsData = {
        breaking: aiAnalysis?.breaking || {
            title: articles[0]?.title || 'Minnesota fraud investigations continue',
            source: articles[0]?.source || 'Various',
            link: articles[0]?.link || '',
            importance: 'Latest development in ongoing investigations'
        },
        articles: articles.slice(0, 12).map(a => ({
            title: a.title,
            source: a.source,
            date: a.date,
            link: a.link
        })),
        lastUpdated: timestamp
    };
    saveData('news.json', newsData);
    
    // 2. Update trending.json
    console.log('  Updating trending.json...');
    const trendingTopics = aiAnalysis?.trending || [];
    trendingTopics.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    saveData('trending.json', {
        topics: trendingTopics,
        lastUpdated: timestamp
    });
    
    // 3. Update investigations.json
    console.log('  Updating investigations.json...');
    let investigations = loadData('investigations.json') || { cases: [], lastUpdated: '' };
    if (aiAnalysis?.investigationUpdates) {
        for (const update of aiAnalysis.investigationUpdates) {
            const existing = investigations.cases.find(c => 
                c.name.toLowerCase().includes(update.name.toLowerCase()) ||
                update.name.toLowerCase().includes(c.name.toLowerCase())
            );
            
            const validatedUrl = await validateUrl(update.sourceUrl, update.name);
            
            if (existing) {
                existing.latestUpdate = update.update;
                existing.sourceUrl = validatedUrl;
                existing.lastUpdated = timestamp;
                existing.isNew = false;
            } else if (update.isNew) {
                investigations.cases.unshift({
                    id: update.name.toLowerCase().replace(/\s+/g, '-'),
                    name: update.name,
                    amount: update.amount || 'Under Investigation',
                    status: update.status || 'Active Investigation',
                    latestUpdate: update.update,
                    sourceUrl: validatedUrl,
                    isNew: true,
                    addedDate: timestamp,
                    lastUpdated: timestamp
                });
            }
        }
    }
    investigations.lastUpdated = timestamp;
    saveData('investigations.json', investigations);
    
    // 4. Update figures.json
    console.log('  Updating figures.json...');
    let figures = loadData('figures.json') || { people: [], lastUpdated: '' };
    if (aiAnalysis?.figureUpdates) {
        for (const update of aiAnalysis.figureUpdates) {
            const existing = figures.people.find(p => 
                p.name.toLowerCase() === update.name.toLowerCase()
            );
            
            const validatedUrl = await validateUrl(update.sourceUrl, update.name);
            
            if (existing) {
                existing.latestUpdate = update.update;
                existing.status = update.status || existing.status;
                existing.sourceUrl = validatedUrl;
                existing.lastUpdated = timestamp;
                existing.isNew = false;
            } else if (update.isNew) {
                figures.people.unshift({
                    name: update.name,
                    role: update.role,
                    status: update.status,
                    allegations: [update.update],
                    latestUpdate: update.update,
                    sourceUrl: validatedUrl,
                    isNew: true,
                    addedDate: timestamp,
                    lastUpdated: timestamp
                });
            }
        }
    }
    figures.people.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    figures.lastUpdated = timestamp;
    saveData('figures.json', figures);
    
    // 5. Update story-ideas.json
    console.log('  Updating story-ideas.json...');
    const storyIdeas = aiAnalysis?.storyIdeas || [];
    storyIdeas.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    saveData('story-ideas.json', {
        ideas: storyIdeas.slice(0, 8),
        lastUpdated: timestamp
    });
    
    // 6. Update stats.json - FIX GREETING
    console.log('  Updating stats.json...');
    const rawBriefing = aiAnalysis?.briefing || 'The AI is analyzing the latest developments.';
    const fixedBriefing = fixBriefingGreeting(rawBriefing);
    
    const statsData = {
        lastUpdated: timestamp,
        charged: {
            count: aiAnalysis?.stats?.charged || 93,
            source: "DOJ Minnesota & Court Records",
            sourceUrl: "https://www.justice.gov/usao-mn"
        },
        convicted: {
            count: aiAnalysis?.stats?.convicted || 57,
            source: "DOJ Feeding Our Future Case",
            sourceUrl: "https://www.justice.gov/usao-mn/pr/feeding-our-future"
        },
        alleged: {
            amount: aiAnalysis?.stats?.alleged || "$9B+",
            source: "House Oversight Committee",
            sourceUrl: "https://oversight.house.gov/"
        },
        cases: {
            count: investigations.cases?.length || 4,
            list: investigations.cases?.map(c => c.name) || [],
            source: "FBI / DOJ Minnesota",
            sourceUrl: "https://www.fbi.gov/contact-us/field-offices/minneapolis"
        },
        briefing: fixedBriefing
    };
    saveData('stats.json', statsData);
    
    // 7. Update search-terms.json
    console.log('  Updating search-terms.json...');
    let searchTerms = loadData('search-terms.json') || { terms: [] };
    if (aiAnalysis?.newSearchTerms?.length > 0) {
        const newTerms = aiAnalysis.newSearchTerms.filter(t => 
            t && !searchTerms.terms.some(existing => 
                existing.toLowerCase() === t.toLowerCase()
            )
        );
        if (newTerms.length > 0) {
            searchTerms.terms = [...newTerms, ...searchTerms.terms].slice(0, 50);
            console.log(`    Added ${newTerms.length} new search terms`);
        }
    }
    searchTerms.lastUpdated = timestamp;
    saveData('search-terms.json', searchTerms);
    
    // 8. Update high-risk-programs.json
    console.log('  Updating high-risk-programs.json...');
    let programs = loadData('high-risk-programs.json') || { programs: [] };
    if (aiAnalysis?.newHighRiskPrograms?.length > 0) {
        const newProgs = aiAnalysis.newHighRiskPrograms.filter(p => 
            p && !programs.programs.some(existing => 
                existing.toLowerCase() === p.toLowerCase()
            )
        );
        if (newProgs.length > 0) {
            programs.programs.push(...newProgs);
            console.log(`    Added ${newProgs.length} new high-risk programs`);
        }
    }
    programs.lastUpdated = timestamp;
    saveData('high-risk-programs.json', programs);
    
    // 9. Update red-flags.json - IMPROVED DEDUPLICATION
    console.log('  Updating red-flags.json...');
    let redFlags = loadData('red-flags.json') || { flags: [], flagTypes: [], sourcesUsed: [] };
    
    // Get sources from OSINT - no fallback
    const sourcesUsed = osintResults?.sourcesUsed || [];
    const sourceCount = osintResults?.sourceCount || sourcesUsed.length;
    
    if (sourcesUsed.length === 0) {
        console.log('    Warning: No OSINT sources available');
    }
    
    // Collect new flags
    const newFlags = [];
    
    // Add from AI analysis
    if (aiAnalysis?.redFlags?.length > 0) {
        aiAnalysis.redFlags.forEach(f => {
            newFlags.push({
                ...f,
                detectedAt: timestamp,
                source: 'ai-analysis',
                sourcesUsed: sourcesUsed,
                sourceCount: sourceCount
            });
        });
    }
    
    // Add from detective
    if (detectiveFindings?.suspiciousPatterns?.length > 0) {
        detectiveFindings.suspiciousPatterns.forEach(p => {
            newFlags.push({
                type: p.type,
                description: p.description,
                entities: p.entities,
                priority: p.priority,
                detectedAt: timestamp,
                source: 'ai-detective',
                sourcesUsed: sourcesUsed,
                sourceCount: sourceCount
            });
        });
    }
    
    // Combine with existing
    redFlags.flags = [...newFlags, ...redFlags.flags];
    
    // IMPROVED DEDUPLICATION
    const beforeCount = redFlags.flags.length;
    redFlags.flags = deduplicateFlags(redFlags.flags).slice(0, 100);
    const afterCount = redFlags.flags.length;
    
    if (beforeCount !== afterCount) {
        console.log(`    Deduplicated: ${beforeCount} → ${afterCount} flags`);
    }
    
    redFlags.sourcesUsed = sourcesUsed;
    redFlags.sourceCount = sourceCount;
    redFlags.lastUpdated = timestamp;
    saveData('red-flags.json', redFlags);
    
    // 10. Update osint-results.json
    if (osintResults && (osintResults.domains?.length > 0 || osintResults.emails?.length > 0)) {
        console.log('  Updating osint-results.json...');
        let osintData = loadData('osint-results.json') || { results: [], lastUpdated: '' };
        osintData.results.unshift({
            timestamp,
            ...osintResults
        });
        osintData.results = osintData.results.slice(0, 50);
        osintData.lastUpdated = timestamp;
        saveData('osint-results.json', osintData);
    }
    
    console.log('  All data files updated!');
}

module.exports = {
    loadData,
    saveData,
    createGitHubIssue,
    checkApprovedIssues,
    updateAllDataFiles,
    fixBriefingGreeting,
    getCorrectGreeting,
    validateUrl,
    deduplicateFlags,
    normalizeForDedup,
    createFlagHash
};
