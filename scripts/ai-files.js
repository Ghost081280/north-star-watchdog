/**
 * NORTH STAR WATCHDOG - AI FILES
 * Handles all file operations and GitHub Issues communication
 */

const fs = require('fs');
const https = require('https');

// GitHub configuration from environment
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPOSITORY || 'Ghost081280/north-star-watchdog';

// ============================================
// FILE OPERATIONS
// ============================================

/**
 * Load JSON data file
 */
function loadData(filename) {
    try {
        return JSON.parse(fs.readFileSync(`data/${filename}`, 'utf8'));
    } catch {
        return null;
    }
}

/**
 * Save JSON data file
 */
function saveData(filename, data) {
    fs.writeFileSync(`data/${filename}`, JSON.stringify(data, null, 2));
    console.log(`    Saved ${filename}`);
}

// ============================================
// GITHUB ISSUES
// ============================================

/**
 * Create a GitHub Issue for AI to communicate with Andrew
 */
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

/**
 * Check for approved issues (issues with "approved" comment)
 */
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
// DATA FILE UPDATERS
// ============================================

/**
 * Update all data files from AI analysis
 */
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
    
    // 2. Update trending.json (sort NEW first)
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
            if (existing) {
                existing.latestUpdate = update.update;
                existing.sourceUrl = update.sourceUrl || existing.sourceUrl;
                existing.lastUpdated = timestamp;
                existing.isNew = false;
            } else if (update.isNew) {
                investigations.cases.unshift({
                    id: update.name.toLowerCase().replace(/\s+/g, '-'),
                    name: update.name,
                    amount: update.amount || 'Under Investigation',
                    status: update.status || 'Active Investigation',
                    latestUpdate: update.update,
                    sourceUrl: update.sourceUrl,
                    isNew: true,
                    addedDate: timestamp,
                    lastUpdated: timestamp
                });
            }
        }
    }
    investigations.lastUpdated = timestamp;
    saveData('investigations.json', investigations);
    
    // 4. Update figures.json (sort NEW first)
    console.log('  Updating figures.json...');
    let figures = loadData('figures.json') || { people: [], lastUpdated: '' };
    if (aiAnalysis?.figureUpdates) {
        for (const update of aiAnalysis.figureUpdates) {
            const existing = figures.people.find(p => 
                p.name.toLowerCase() === update.name.toLowerCase()
            );
            if (existing) {
                existing.latestUpdate = update.update;
                existing.status = update.status || existing.status;
                existing.sourceUrl = update.sourceUrl || existing.sourceUrl;
                existing.lastUpdated = timestamp;
                existing.isNew = false;
            } else if (update.isNew) {
                figures.people.unshift({
                    name: update.name,
                    role: update.role,
                    status: update.status,
                    allegations: [update.update],
                    latestUpdate: update.update,
                    sourceUrl: update.sourceUrl,
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
    
    // 5. Update story-ideas.json (sort NEW first)
    console.log('  Updating story-ideas.json...');
    const storyIdeas = aiAnalysis?.storyIdeas || [];
    storyIdeas.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    saveData('story-ideas.json', {
        ideas: storyIdeas.slice(0, 8),
        lastUpdated: timestamp
    });
    
    // 6. Update stats.json with AI briefing
    console.log('  Updating stats.json...');
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
        briefing: aiAnalysis?.briefing || "Good morning. The AI is currently analyzing the latest developments in Minnesota's fraud investigations. Check back soon for today's briefing."
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
    
    // 9. Update red-flags.json
    console.log('  Updating red-flags.json...');
    let redFlags = loadData('red-flags.json') || { flags: [], flagTypes: [], sourcesUsed: [] };
    
    // Get sources actually used from OSINT results
    const sourcesUsed = osintResults?.sourcesUsed || ['Google News', 'DOJ Press', 'FBI Press', 'SAM.gov', 'OFAC Sanctions', 'OIG Exclusions'];
    const sourceCount = osintResults?.sourceCount || sourcesUsed.length;
    
    // Add red flags from AI analysis
    if (aiAnalysis?.redFlags?.length > 0) {
        const newFlags = aiAnalysis.redFlags.map(f => ({
            ...f,
            detectedAt: timestamp,
            source: 'ai-analysis',
            sourcesUsed: sourcesUsed,
            sourceCount: sourceCount
        }));
        redFlags.flags = [...newFlags, ...redFlags.flags].slice(0, 100);
    }
    
    // Add patterns from detective
    if (detectiveFindings?.suspiciousPatterns?.length > 0) {
        const detectiveFlags = detectiveFindings.suspiciousPatterns.map(p => ({
            type: p.type,
            description: p.description,
            entities: p.entities,
            priority: p.priority,
            detectedAt: timestamp,
            source: 'ai-detective',
            sourcesUsed: sourcesUsed,
            sourceCount: sourceCount
        }));
        redFlags.flags = [...detectiveFlags, ...redFlags.flags].slice(0, 100);
    }
    
    // Store global sources used for this run
    redFlags.sourcesUsed = sourcesUsed;
    redFlags.sourceCount = sourceCount;
    redFlags.lastUpdated = timestamp;
    saveData('red-flags.json', redFlags);
    
    // 10. Update osint-results.json (if we have OSINT data)
    if (osintResults && (osintResults.domains?.length > 0 || osintResults.emails?.length > 0)) {
        console.log('  Updating osint-results.json...');
        let osintData = loadData('osint-results.json') || { results: [], lastUpdated: '' };
        osintData.results.unshift({
            timestamp,
            ...osintResults
        });
        osintData.results = osintData.results.slice(0, 50); // Keep last 50 runs
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
    updateAllDataFiles
};
