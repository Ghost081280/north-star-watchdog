#!/usr/bin/env node
/**
 * NORTH STAR WATCHDOG - AI CORE
 * Main orchestrator for hourly scans
 * 
 * WHAT THIS ACTUALLY DOES:
 * 1. Scrapes Google News RSS for Minnesota fraud stories
 * 2. Sends news to GROQ AI for analysis
 * 3. AI extracts: figures, investigations, trending topics, red flags, story ideas
 * 4. Calls FREE OSINT APIs to enrich findings
 * 5. Updates all data/*.json files with real data
 * 6. Creates GitHub Issues for high-confidence red flags
 * 
 * REQUIRED: GROQ_API_KEY (free at console.groq.com)
 * OPTIONAL: None - all other APIs are free and keyless
 */

const fs = require('fs');
const path = require('path');

// Import modules
const { scrapeGoogleNews } = require('./ai-scraper');
const { analyzeWithGroq } = require('./ai-analyzer');
const { enrichFindings } = require('./ai-osint');
const { updateAllDataFiles, createGitHubIssues, updateLearning } = require('./ai-files');

// ============================================
// MAIN WORKFLOW
// ============================================

async function main() {
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║     NORTH STAR WATCHDOG - AI HOURLY SCAN                   ║');
    console.log('║     ' + new Date().toISOString() + '                    ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    const startTime = Date.now();
    
    try {
        // ============================================
        // STEP 1: Scrape news
        // ============================================
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
        // DONE
        // ============================================
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║     SCAN COMPLETE                                          ║');
        console.log(`║     Duration: ${duration}s                                        ║`);
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
    } catch (error) {
        console.error('\n❌ SCAN FAILED:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run
main();
