/**
 * NORTH STAR WATCHDOG - AI CORE v2.0
 * Main orchestrator that coordinates all AI modules
 * 
 * FIXES:
 * - Uses AI-provided confidence scores (not heuristics)
 * - Better error handling
 * - Improved logging
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
    console.log('════════════════════════════════════════════════');
    console.log('  NORTH STAR WATCHDOG - AI UPDATER v2.0');
    console.log('════════════════════════════════════════════════');
    console.log(`  Time: ${new Date().toLocaleString('en-US', { timeZone: CONFIG.timezone })} CST`);
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
        console.log('\n[PHASE 1] 📰 Scraping news sources...');
        const articles = await scraper.scrapeAllNews();
        console.log(`  Found ${articles.length} unique articles`);

        if (articles.length === 0) {
            console.log('  No articles found, keeping existing data');
            return;
        }

        // ========================================
        // PHASE 2: AI ANALYSIS
        // ========================================
        console.log('\n[PHASE 2] 🤖 Running AI analysis...');
        const aiAnalysis = await analyzer.analyzeNews(articles);
        
        if (aiAnalysis) {
            console.log('  AI Analysis results:');
            console.log(`    • Breaking: ${aiAnalysis.breaking?.title?.substring(0, 50) || 'None'}...`);
            console.log(`    • Trending: ${aiAnalysis.trending?.length || 0} topics`);
            console.log(`    • Figure updates: ${aiAnalysis.figureUpdates?.length || 0}`);
            console.log(`    • Investigation updates: ${aiAnalysis.investigationUpdates?.length || 0}`);
            console.log(`    • Story ideas: ${aiAnalysis.storyIdeas?.length || 0}`);
            console.log(`    • Red flags: ${aiAnalysis.redFlags?.length || 0}`);
            
            // Log confidence score distribution
            if (aiAnalysis.redFlags?.length > 0) {
                const confidences = aiAnalysis.redFlags.map(f => f.confidence || 70);
                const avg = Math.round(confidences.reduce((a,b) => a+b, 0) / confidences.length);
                const min = Math.min(...confidences);
                const max = Math.max(...confidences);
                console.log(`    • Confidence scores: ${min}%-${max}% (avg: ${avg}%)`);
            }
        }

        // ========================================
        // PHASE 3: DETECTIVE WORK (Pattern Detection)
        // ========================================
        console.log('\n[PHASE 3] 🕵️ Running detective analysis...');
        const detectiveFindings = await detective.analyzePatterns(articles, aiAnalysis);
        
        if (detectiveFindings?.suspiciousPatterns?.length > 0) {
            console.log(`  Detective found ${detectiveFindings.suspiciousPatterns.length} patterns`);
            
            // Create issue for high/medium priority patterns
            for (const pattern of detectiveFindings.suspiciousPatterns) {
                if (pattern.priority === 'high' || pattern.priority === 'medium') {
                    // USE AI-PROVIDED CONFIDENCE - not heuristics
                    const confidenceScore = pattern.confidence || 70;
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
        } else {
            console.log('  No new suspicious patterns detected');
        }

        // ========================================
        // PHASE 4: OSINT ENRICHMENT
        // ========================================
        console.log('\n[PHASE 4] 🔍 Running OSINT enrichment...');
        const osintResults = await osint.enrichFindings(aiAnalysis, detectiveFindings);
        
        // Log OSINT summary
        if (osintResults) {
            console.log('  OSINT Summary:');
            console.log(`    • Sources with data: ${osintResults.sourcesUsed?.length || 0}`);
            console.log(`    • Spending records: ${osintResults.spending?.length || 0}`);
            console.log(`    • Nonprofits found: ${osintResults.nonprofits?.length || 0}`);
            console.log(`    • Campaign records: ${osintResults.campaigns?.length || 0}`);
            console.log(`    • Court cases: ${osintResults.courts?.length || 0}`);
            console.log(`    • Companies: ${osintResults.companies?.length || 0}`);
            console.log(`    • Sanctions matches: ${osintResults.sanctions?.length || 0}`);
        }
        
        // Check API status and warn if limits are close
        const apiStatus = osint.getApiStatus();
        if (apiStatus.stats) {
            console.log(`  API Stats: ${apiStatus.stats.calls} calls, ${apiStatus.stats.successes} successes, ${apiStatus.stats.failures} failures`);
        }

        // ========================================
        // PHASE 5: UPDATE ALL DATA FILES
        // ========================================
        console.log('\n[PHASE 5] 💾 Updating data files...');
        await files.updateAllDataFiles(articles, aiAnalysis, detectiveFindings, osintResults);

        // ========================================
        // PHASE 6: REPORT NEW DISCOVERIES
        // ========================================
        console.log('\n[PHASE 6] 📢 Checking for discoveries to report...');
        
        // Report new high-risk programs discovered
        if (aiAnalysis?.newHighRiskPrograms?.length > 0) {
            console.log(`  Found ${aiAnalysis.newHighRiskPrograms.length} new high-risk programs`);
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

        // Report significant OSINT findings
        if (osintResults?.sanctions?.some(s => s.found > 0)) {
            const sanctionMatches = osintResults.sanctions.filter(s => s.found > 0);
            await files.createGitHubIssue({
                title: `⚠️ SANCTIONS MATCH FOUND`,
                body: `Hey Andrew! 🚨

**This is important** - I found potential matches in the OFAC sanctions database:

${sanctionMatches.map(s => `**Query:** ${s.query}\n**Matches:** ${s.found}\n${s.matches?.map(m => `- ${m.name} (${m.source})`).join('\n')}`).join('\n\n')}

⚠️ **Note:** This needs manual verification. Sanctions matches can be false positives due to common names.

**Recommended:** Check the official OFAC search: https://sanctionssearch.ofac.treas.gov/

---
*Your AI Detective 🕵️*`,
                labels: ['ai-alert', 'high-priority', 'needs-review']
            });
        }

        console.log('\n════════════════════════════════════════════════');
        console.log('  AI UPDATE COMPLETE ✓');
        console.log('════════════════════════════════════════════════');

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error(error.stack);
        
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

// ============================================
// HELPER: Build friendly GitHub issue body
// ============================================

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
${confidence >= 80 ? '*(High confidence - multiple sources or official records confirm this)*' : 
  confidence >= 60 ? '*(Medium confidence - credible source but needs verification)*' : 
  '*(Lower confidence - pattern detected but unconfirmed)*'}

**Entities involved:**
${pattern.entities?.map(e => `- ${e}`).join('\n') || '- Unknown'}

${pattern.sourceUrl ? `**Source:** [View Article](${pattern.sourceUrl})` : ''}

## 🔗 Quick Links
${searches}
- [Search on site](https://ghost081280.github.io/north-star-watchdog/?q=${encodeURIComponent(entities.split(',')[0])})
- [DOJ Minnesota](https://www.justice.gov/usao-mn)
- [MN DHS Licensing](https://licensinglookup.dhs.state.mn.us/)
- [ProPublica Nonprofits](https://projects.propublica.org/nonprofits/search?q=${encodeURIComponent(entities.split(',')[0])})
- [USASpending](https://www.usaspending.gov/search/?hash=recipient:${encodeURIComponent(entities.split(',')[0])})

## 💡 Recommended Action
${pattern.recommendation || 'Take a look when you have time - might be worth digging into.'}

---
*Your AI Detective 🕵️*
*Scanned at: ${new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })} CST*`;
}

// Run
main();
