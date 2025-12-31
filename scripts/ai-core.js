/**
 * NORTH STAR WATCHDOG - AI CORE
 * Main orchestrator that coordinates all AI modules
 * 
 * Modules:
 * - ai-scraper.js: News scraping, RSS feeds
 * - ai-analyzer.js: GROQ AI analysis
 * - ai-detective.js: Pattern detection, beyond the news
 * - ai-osint.js: Dark web, WHOIS, phone lookups
 * - ai-files.js: File management, GitHub issues
 */

const fs = require('fs');
const path = require('path');

// Import modules
const scraper = require('./ai-scraper');
const analyzer = require('./ai-analyzer');
const detective = require('./ai-detective');
const osint = require('./ai-osint');
const files = require('./ai-files');

// Configuration
const CONFIG = {
    dataDir: 'data',
    timezone: 'America/Chicago',
    maxArticles: 30,
    maxSearchTerms: 50
};

// ============================================
// MAIN ORCHESTRATOR
// ============================================

async function main() {
    console.log('========================================');
    console.log('NORTH STAR WATCHDOG - AI UPDATER v2.0');
    console.log('========================================');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('');

    // Check for required API key
    if (!process.env.GROQ_API_KEY) {
        console.error('ERROR: GROQ_API_KEY not set!');
        await files.createGitHubIssue({
            title: 'GROQ API Key Missing',
            body: 'The AI updater cannot run without GROQ_API_KEY.\n\n**Setup:**\n1. Get FREE key: https://console.groq.com/keys\n2. Add to GitHub Secrets: Settings > Secrets > Actions\n3. Name: `GROQ_API_KEY`',
            labels: ['ai-alert', 'api-key']
        });
        process.exit(1);
    }

    // Ensure data directory exists
    if (!fs.existsSync(CONFIG.dataDir)) {
        fs.mkdirSync(CONFIG.dataDir, { recursive: true });
    }

    try {
        // ========================================
        // PHASE 1: SCRAPE NEWS
        // ========================================
        console.log('\n[PHASE 1] Scraping news sources...');
        const articles = await scraper.scrapeAllNews();
        console.log(`Found ${articles.length} unique articles`);

        if (articles.length === 0) {
            console.log('No articles found, keeping existing data');
            return;
        }

        // ========================================
        // PHASE 2: AI ANALYSIS
        // ========================================
        console.log('\n[PHASE 2] Running AI analysis...');
        const aiAnalysis = await analyzer.analyzeNews(articles);
        
        if (aiAnalysis) {
            console.log('AI Analysis results:');
            console.log(`  - Breaking: ${aiAnalysis.breaking?.title || 'None'}`);
            console.log(`  - Trending: ${aiAnalysis.trending?.length || 0} topics`);
            console.log(`  - Figure updates: ${aiAnalysis.figureUpdates?.length || 0}`);
            console.log(`  - Investigation updates: ${aiAnalysis.investigationUpdates?.length || 0}`);
            console.log(`  - Story ideas: ${aiAnalysis.storyIdeas?.length || 0}`);
            console.log(`  - New search terms: ${aiAnalysis.newSearchTerms?.length || 0}`);
            console.log(`  - Red flags: ${aiAnalysis.redFlags?.length || 0}`);
        }

        // ========================================
        // PHASE 3: DETECTIVE WORK (Pattern Detection)
        // ========================================
        console.log('\n[PHASE 3] Running detective analysis...');
        const detectiveFindings = await detective.analyzePatterns(articles, aiAnalysis);
        
        if (detectiveFindings?.suspiciousPatterns?.length > 0) {
            console.log(`Detective found ${detectiveFindings.suspiciousPatterns.length} patterns`);
            
            // Create issue for manual review if high-priority pattern found
            for (const pattern of detectiveFindings.suspiciousPatterns) {
                if (pattern.priority === 'high' || pattern.priority === 'medium') {
                    // Calculate confidence score based on evidence
                    const confidenceScore = calculateConfidence(pattern);
                    const confidenceEmoji = confidenceScore >= 80 ? '🔴' : confidenceScore >= 60 ? '🟡' : '🟢';
                    
                    // Build friendly message
                    const friendlyBody = buildFriendlyIssue(pattern, confidenceScore, confidenceEmoji);
                    
                    await files.createGitHubIssue({
                        title: `🔍 ${pattern.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`,
                        body: friendlyBody,
                        labels: ['ai-discovery', 'needs-review', confidenceScore >= 80 ? 'high-priority' : 'medium-priority']
                    });
                }
            }
        }

// Helper function to calculate confidence
function calculateConfidence(pattern) {
    let score = 50; // Base score
    
    if (pattern.entities?.length > 1) score += 10;
    if (pattern.entities?.length > 3) score += 10;
    if (pattern.sourceUrl) score += 15;
    if (pattern.description?.length > 100) score += 10;
    if (pattern.priority === 'high') score += 15;
    
    return Math.min(score, 99);
}

// Helper function to build friendly issue body
function buildFriendlyIssue(pattern, confidence, emoji) {
    const entities = pattern.entities?.join(', ') || 'Unknown';
    const searches = pattern.entities?.map(e => 
        `- [Search "${e}"](https://ghost081280.github.io/north-star-watchdog/?q=${encodeURIComponent(e)})`
    ).join('\n') || '';
    
    return `Hey Andrew! 👋

I noticed something interesting while scanning the news and databases:

## ${emoji} ${pattern.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

**What I found:** ${pattern.description}

**Confidence Score:** ${confidence}% ${emoji}

**Entities involved:**
${pattern.entities?.map(e => `- ${e}`).join('\n') || '- Unknown'}

## 🔗 Quick Links
${searches}
- [Search on site](https://ghost081280.github.io/north-star-watchdog/?q=${encodeURIComponent(entities.split(',')[0])})
- [DOJ Minnesota](https://www.justice.gov/usao-mn)
- [MN DHS Licensing](https://licensinglookup.dhs.state.mn.us/)

## 💡 Recommended Action
${pattern.recommendation || 'Take a look when you have time - might be worth digging into.'}

---
*Your AI Detective 🕵️*
*Scanned at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST*`;
}

        // ========================================
        // PHASE 4: OSINT ENRICHMENT (if APIs available)
        // ========================================
        console.log('\n[PHASE 4] Running OSINT enrichment...');
        const osintResults = await osint.enrichFindings(aiAnalysis, detectiveFindings);
        
        // Check API status and warn if limits are close
        const apiStatus = osint.getApiStatus();
        for (const [api, status] of Object.entries(apiStatus)) {
            if (status.percentUsed > 80) {
                console.log(`WARNING: ${api} at ${status.percentUsed}% of limit`);
                await files.createGitHubIssue({
                    title: `⚠️ Heads up: ${api} API running low`,
                    body: `Hey Andrew! 👋

Just a heads up - I'm running low on my **${api}** API quota.

**Current usage:** ${status.used}/${status.limit} (${status.percentUsed}%)
**Resets:** ${status.resetDate || 'Daily'}

Don't worry though - I'll automatically switch to free alternatives until it resets. You don't need to do anything, just wanted to keep you in the loop!

---
*Your AI Detective 🕵️*`,
                    labels: ['ai-alert', 'api-key']
                });
            }
        }

        // ========================================
        // PHASE 5: UPDATE ALL DATA FILES
        // ========================================
        console.log('\n[PHASE 5] Updating data files...');
        await files.updateAllDataFiles(articles, aiAnalysis, detectiveFindings, osintResults);

        // ========================================
        // PHASE 6: REPORT NEW DISCOVERIES
        // ========================================
        console.log('\n[PHASE 6] Checking for discoveries to report...');
        
        // Report new high-risk programs discovered
        if (aiAnalysis?.newHighRiskPrograms?.length > 0) {
            await files.createGitHubIssue({
                title: `🚨 New High-Risk Program: ${aiAnalysis.newHighRiskPrograms[0]}`,
                body: `Hey Andrew! 👋

I found a program that might be worth keeping an eye on:

**Programs flagged:**
${aiAnalysis.newHighRiskPrograms.map(p => `- ${p}`).join('\n')}

I've added ${aiAnalysis.newHighRiskPrograms.length > 1 ? 'these' : 'this'} to my tracking list automatically. I'll watch for any news or patterns involving ${aiAnalysis.newHighRiskPrograms.length > 1 ? 'them' : 'it'}.

**Your call:** Reply "approved" if this looks legit, or close this issue if it's not relevant.

---
*Your AI Detective 🕵️*`,
                labels: ['ai-discovery', 'needs-approval']
            });
        }

        // Report if new API would help
        if (osintResults?.suggestedApis?.length > 0) {
            for (const api of osintResults.suggestedApis) {
                await files.createGitHubIssue({
                    title: `💡 Found a useful tool: ${api.name}`,
                    body: `Hey Andrew! 👋

I came across a free service that could help with investigations:

## ${api.name}

**What it does:** ${api.description}
**Free tier:** ${api.freeTier}
**Signup:** ${api.signupUrl}

**To add it:**
1. Sign up at the link above (free, no credit card)
2. Add the API key to GitHub Secrets: \`${api.secretName}\`

Reply "approved" and I'll start using it on the next scan!

---
*Your AI Detective 🕵️*`,
                    labels: ['ai-request', 'api-key']
                });
            }
        }

        console.log('\n========================================');
        console.log('AI UPDATE COMPLETE');
        console.log('========================================');

    } catch (error) {
        console.error('Fatal error:', error);
        
        await files.createGitHubIssue({
            title: `🔧 Oops - Something broke`,
            body: `Hey Andrew,

I ran into an error during my scan. Here's what happened:

\`\`\`
${error.stack || error.message}
\`\`\`

**Time:** ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST

This might fix itself on the next run, but wanted to let you know!

---
*Your AI Detective 🕵️*`,
            labels: ['ai-alert']
        });
        
        process.exit(1);
    }
}

// Run
main();
