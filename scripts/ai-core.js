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
                if (pattern.priority === 'high') {
                    await files.createGitHubIssue({
                        title: `Pattern Detected: ${pattern.type}`,
                        body: `**AI Detective found a suspicious pattern:**\n\n${pattern.description}\n\n**Entities involved:** ${pattern.entities?.join(', ') || 'Unknown'}\n\n**Recommended action:** ${pattern.recommendation || 'Manual review needed'}`,
                        labels: ['ai-discovery', 'needs-review']
                    });
                }
            }
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
                    title: `API Limit Warning: ${api}`,
                    body: `**${api}** is at **${status.percentUsed}%** of its monthly/daily limit.\n\nUsed: ${status.used}/${status.limit}\nResets: ${status.resetDate || 'Daily'}\n\nI'll use free alternatives until it resets.`,
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
                title: `New High-Risk Program Discovered: ${aiAnalysis.newHighRiskPrograms[0]}`,
                body: `**AI discovered a new program that may be at risk for fraud:**\n\n${aiAnalysis.newHighRiskPrograms.join('\n- ')}\n\nThis has been added to the tracking list automatically.\n\nReply with "approved" to confirm, or close this issue if not relevant.`,
                labels: ['ai-discovery', 'needs-approval']
            });
        }

        // Report if new API would help
        if (osintResults?.suggestedApis?.length > 0) {
            for (const api of osintResults.suggestedApis) {
                await files.createGitHubIssue({
                    title: `New API Suggested: ${api.name}`,
                    body: `**I found a free service that would help investigations:**\n\n**Service:** ${api.name}\n**What it does:** ${api.description}\n**Free tier:** ${api.freeTier}\n**Signup:** ${api.signupUrl}\n\n**To add:**\n1. Sign up at the link above\n2. Add secret: \`${api.secretName}\`\n\nReply "approved" and I'll start using it.`,
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
            title: `AI Updater Error: ${error.message?.substring(0, 50)}`,
            body: `**The AI updater encountered an error:**\n\n\`\`\`\n${error.stack || error.message}\n\`\`\`\n\nTime: ${new Date().toISOString()}`,
            labels: ['ai-alert']
        });
        
        process.exit(1);
    }
}

// Run
main();
