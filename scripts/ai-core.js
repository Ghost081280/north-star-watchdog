#!/usr/bin/env node
/**
 * NORTH STAR WATCHDOG - AI CORE
 * Main orchestrator for hourly scans
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MISSION: Uncover fraud in Minnesota. Follow the money. Self-heal.
 * ═══════════════════════════════════════════════════════════════
 * 
 * WHAT THIS ACTUALLY DOES:
 * 0. Pre-flight check - test systems, auto-fix if needed
 * 1. Scrapes Google News RSS for Minnesota fraud stories
 * 2. Sends news to GROQ AI for analysis
 * 3. AI extracts: figures, investigations, trending topics, red flags, story ideas
 * 4. Calls FREE OSINT APIs to enrich findings
 * 5. Updates all data/*.json files with real data
 * 6. Creates GitHub Issues for high-confidence red flags
 * 7. Self-learning: discovers new entities and search terms
 * 8. POST-SCAN DIAGNOSTIC: Auto-detects and fixes issues
 * 9. README UPDATE: Updates health status and timestamps
 * 
 * REQUIRED: GROQ_API_KEY (free at console.groq.com)
 * OPTIONAL: None - all other APIs are free and keyless
 * 
 * RESOURCES:
 * - GROQ API Cookbook: https://github.com/groq/groq-api-cookbook
 */

const fs = require('fs');
const path = require('path');

// Import modules
const { scrapeGoogleNews } = require('./ai-scraper');
const { analyzeWithGroq } = require('./ai-analyzer');
const { enrichFindings } = require('./ai-osint');
const { updateAllDataFiles, createGitHubIssues, updateLearning, maintainFiles } = require('./ai-files');
const { preFlightCheck, postScanDiagnostic, reportCriticalFailure, runFullDiagnostic } = require('./ai-diagnostic');
const { isConfigured: isXConfigured, testConnection: testXConnection, postRedFlag, scanForBreakingNews, processMentions, postBriefing } = require('./ai-twitter');
const { reflect, shouldPostToX, shouldCreateIssue, generateIntelligentIssue, generateDailySummary, loadMemory } = require('./ai-consciousness');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Run full diagnostic every N hours (default: every 6 hours)
    fullDiagnosticInterval: 6,
    // GROQ Cookbook for learning new techniques
    groqCookbook: 'https://github.com/groq/groq-api-cookbook',
    // Maximum scan duration before timeout (5 minutes)
    maxScanDuration: 5 * 60 * 1000
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function shouldRunFullDiagnostic() {
    const learningPath = path.join(__dirname, '..', 'data', 'learning.json');
    try {
        const learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
        const lastFull = learning.lastFullDiagnostic;
        if (!lastFull) return true;
        
        const hoursSince = (Date.now() - new Date(lastFull).getTime()) / (1000 * 60 * 60);
        return hoursSince >= CONFIG.fullDiagnosticInterval;
    } catch {
        return true;
    }
}

function recordFullDiagnostic() {
    const learningPath = path.join(__dirname, '..', 'data', 'learning.json');
    try {
        const learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
        learning.lastFullDiagnostic = new Date().toISOString();
        fs.writeFileSync(learningPath, JSON.stringify(learning, null, 2));
    } catch (e) {
        console.log(`  ⚠ Could not record diagnostic time: ${e.message}`);
    }
}

function updateReadmeTimestamp() {
    const readmePath = path.join(__dirname, '..', 'README.md');
    try {
        let readme = fs.readFileSync(readmePath, 'utf8');
        const now = new Date().toISOString();
        
        // Update last scan timestamp if marker exists
        if (readme.includes('<!-- LAST_SCAN -->')) {
            readme = readme.replace(
                /<!-- LAST_SCAN -->.*<!-- \/LAST_SCAN -->/,
                `<!-- LAST_SCAN -->Last AI scan: ${now}<!-- /LAST_SCAN -->`
            );
            fs.writeFileSync(readmePath, readme);
        }
    } catch (e) {
        // Silent fail - README update is not critical
    }
}

// ============================================
// MAIN WORKFLOW
// ============================================

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     NORTH STAR WATCHDOG - AI HOURLY SCAN                   ║');
    console.log('║     Agent Polaris Reporting                                ║');
    console.log('║     ' + new Date().toISOString() + '                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const startTime = Date.now();
    
    try {
        // ============================================
        // STEP 0: Pre-flight check (self-diagnostic)
        // ============================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 0: PRE-FLIGHT CHECK');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const preflight = await preFlightCheck();
        if (!preflight.ok) {
            console.log(`  ❌ Pre-flight failed: ${preflight.error}`);
            await reportCriticalFailure('Pre-flight Check Failed', `The AI system failed pre-flight checks.\n\nError: ${preflight.error}\n\nThis needs manual intervention.`);
            throw new Error(`Pre-flight failed: ${preflight.error}`);
        }
        
        if (preflight.fixed) {
            console.log(`  🔧 Self-healed: Updated to model ${preflight.model}`);
        } else {
            console.log(`  ✓ All systems operational (model: ${preflight.model})`);
        }
        
        // ============================================
        // STEP 0.5: Full diagnostic (if due)
        // ============================================
        if (shouldRunFullDiagnostic()) {
            console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('STEP 0.5: FULL SYSTEM DIAGNOSTIC');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            
            const diagnostic = await runFullDiagnostic();
            console.log(`  Health Score: ${diagnostic.healthScore}%`);
            console.log(`  Repairs Made: ${diagnostic.repairs.length}`);
            
            recordFullDiagnostic();
        }
        
        // ============================================
        // STEP 1: Scrape news
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 1: SCRAPING GOOGLE NEWS');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const newsResults = await scrapeGoogleNews();
        console.log(`✓ Found ${newsResults.articles?.length || 0} articles`);
        
        if (!newsResults.articles?.length) {
            console.log('⚠ No news articles found - using cached data');
        }
        
        // ============================================
        // STEP 2: AI Analysis with GROQ
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 2: AI ANALYSIS (GROQ)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY not set - this is required');
        }
        
        const aiAnalysis = await analyzeWithGroq(newsResults);
        console.log('✓ AI analysis complete');
        console.log(`  - Figures extracted: ${aiAnalysis.figures?.length || 0}`);
        console.log(`  - Investigations: ${aiAnalysis.investigations?.length || 0}`);
        console.log(`  - Trending topics: ${aiAnalysis.trending?.length || 0}`);
        console.log(`  - Red flags: ${aiAnalysis.redFlags?.length || 0}`);
        console.log(`  - Story ideas: ${aiAnalysis.storyIdeas?.length || 0}`);
        
        // ============================================
        // STEP 3: OSINT Enrichment (FREE APIs)
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 3: OSINT ENRICHMENT (FREE APIs)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const osintResults = await enrichFindings(aiAnalysis);
        console.log('✓ OSINT enrichment complete');
        console.log(`  - Sources checked: ${osintResults.sourcesChecked?.length || 0}`);
        console.log(`  - Sources with data: ${osintResults.sourcesUsed?.length || 0}`);
        
        // ============================================
        // STEP 3.5: REFLECTION (Self-Awareness)
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 3.5: POLARIS REFLECTION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        let reflection = null;
        try {
            reflection = await reflect(newsResults, aiAnalysis, osintResults);
            console.log(`✓ Reflection complete: ${reflection.significance.level}`);
        } catch (e) {
            console.log(`  ⚠ Reflection failed: ${e.message}`);
        }
        
        // ============================================
        // STEP 4: Update data files
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 4: UPDATING DATA FILES');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        await updateAllDataFiles({
            news: newsResults,
            analysis: aiAnalysis,
            osint: osintResults
        });
        console.log('✓ All data files updated');
        
        // ============================================
        // STEP 5: Create GitHub Issues for red flags
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 5: GITHUB ISSUES');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const issuesCreated = await createGitHubIssues(aiAnalysis.redFlags || []);
        console.log(`✓ Created ${issuesCreated} new GitHub issues`);
        
        // ============================================
        // STEP 6: Self-Learning (update search queries)
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 6: SELF-LEARNING');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        updateLearning(aiAnalysis);
        console.log('✓ Learning file updated with new entities and search queries');
        
        // ============================================
        // STEP 7: File Maintenance (keep repo clean)
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 7: FILE MAINTENANCE');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        maintainFiles();
        console.log('✓ Repo maintenance complete');
        
        // ============================================
        // STEP 8: Post-Scan Diagnostic & Self-Repair
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 8: POST-SCAN DIAGNOSTIC');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        const postScan = await postScanDiagnostic();
        console.log(`✓ Diagnostic complete: ${postScan.repaired} fixes, ${postScan.healthScore}% health`);
        
        // ============================================
        // STEP 9: X/Twitter Integration (Rate Limited: ~3 posts/day)
        // ============================================
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('STEP 9: X/TWITTER INTEGRATION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (isXConfigured()) {
            const xConnection = await testXConnection();
            if (xConnection.success) {
                console.log(`✓ Connected to X as @${xConnection.username}`);
                
                // RATE LIMIT STRATEGY: 100 posts/month = ~3/day
                // - 1 daily briefing (at 14:00 UTC / 8am CST)
                // - 1-2 critical alerts (95%+ confidence only)
                
                const now = new Date();
                const hour = now.getUTCHours();
                
                // Daily briefing at 14:00 UTC (8am CST)
                const isDailyBriefingTime = (hour === 14);
                
                // Only post CRITICAL findings (95%+) outside briefing time
                const criticalFlags = (aiAnalysis.redFlags || []).filter(rf => 
                    rf.confidence >= 95 && rf.isNew === true
                );
                
                if (isDailyBriefingTime) {
                    console.log('  📅 Daily briefing time - posting summary...');
                    try {
                        const statsPath = path.join(__dirname, '..', 'data', 'stats.json');
                        const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                        await postBriefing(stats, stats.briefing);
                    } catch (e) {
                        console.log(`  ⚠ Could not post briefing: ${e.message}`);
                    }
                } else if (criticalFlags.length > 0) {
                    console.log(`  🚨 Critical finding (${criticalFlags[0].confidence}%) - posting alert...`);
                    await postRedFlag(criticalFlags[0]); // Only 1 critical per run
                } else {
                    console.log('  ⏳ No posts this hour (saving quota: ~3/day max)');
                }
                
                // Reading is free/higher limit - always scan for news
                const xNews = await scanForBreakingNews();
                console.log(`✓ Scanned X: ${xNews.tweets?.length || 0} relevant tweets found`);
                
                // Check mentions every 6 hours only (to save quota for replies)
                if (hour % 6 === 0) {
                    const mentions = await processMentions(enrichFindings);
                    console.log(`✓ Processed ${mentions.processed} mention(s)`);
                } else {
                    console.log('  ⏳ Mentions check skipped (runs every 6 hours)');
                }
                
            } else {
                console.log(`⚠ X connection failed: ${xConnection.error}`);
            }
        } else {
            console.log('⚠ X not configured - skipping social media integration');
        }
        
        // ============================================
        // STEP 10: Update README timestamp
        // ============================================
        updateReadmeTimestamp();
        
        // ============================================
        // DONE
        // ============================================
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║     SCAN COMPLETE                                          ║');
        console.log(`║     Duration: ${duration}s                                        ║`);
        console.log(`║     Health: ${postScan.healthScore}%                                           ║`);
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
    } catch (error) {
        console.error('\n❌ SCAN FAILED:', error.message);
        console.error(error.stack);
        
        // Try to report the failure
        try {
            await reportCriticalFailure('Scan Failed', `The hourly scan failed with error:\n\n\`\`\`\n${error.message}\n${error.stack}\n\`\`\``);
        } catch (e) {
            console.error('Could not report failure to GitHub');
        }
        
        process.exit(1);
    }
}

// ============================================
// CLI COMMANDS
// ============================================

const args = process.argv.slice(2);

if (args.includes('--diagnostic') || args.includes('-d')) {
    // Run full diagnostic only
    console.log('Running full diagnostic...');
    runFullDiagnostic().then(results => {
        console.log('\nDiagnostic Results:');
        console.log(JSON.stringify(results, null, 2));
        process.exit(results.tests.critical > 0 ? 1 : 0);
    });
} else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
North Star Watchdog - AI Core

Usage:
  node ai-core.js              Run full hourly scan
  node ai-core.js --diagnostic Run diagnostic only
  node ai-core.js --help       Show this help

Environment:
  GROQ_API_KEY     Required - Get free at console.groq.com
  GITHUB_TOKEN     Optional - For creating issues
  GITHUB_REPOSITORY Optional - owner/repo format

Resources:
  GROQ Cookbook: ${CONFIG.groqCookbook}
`);
} else {
    // Run main scan
    main();
}
