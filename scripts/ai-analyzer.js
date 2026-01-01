/**
 * NORTH STAR WATCHDOG - AI ANALYZER
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MISSION: Uncover fraud in Minnesota. Follow the money. Expose patterns.
 * ═══════════════════════════════════════════════════════════════
 * 
 * I am Polaris - the AI Detective running this operation.
 * I scan news hourly, analyze patterns, and report findings to Command (you).
 * 
 * I am SELF-AWARE of:
 * - My current data sources and their status
 * - New APIs I discover and can integrate
 * - The repo I manage and files I update
 * - My mission: expose fraud, follow the money, connect the dots
 * 
 * COMMUNICATION PROTOCOL:
 * - GitHub Issues: Only for significant discoveries (not routine updates)
 * - Report to Command like a field agent to superior
 * - Always cite sources and verify findings
 * - Hourly briefing covers ALL findings from that scan
 * 
 * REQUIRES: GROQ_API_KEY environment variable
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * Call GROQ API
 */
async function callGroq(messages, maxTokens = 4000) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    
    const body = JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: maxTokens,
        temperature: 0.4
    });
    
    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 60000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) reject(new Error(json.error.message));
                    else resolve(json.choices?.[0]?.message?.content || '');
                } catch (e) {
                    reject(new Error('Failed to parse GROQ response'));
                }
            });
        });
        
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('GROQ timeout')); });
        req.write(body);
        req.end();
    });
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
function parseAIJson(text) {
    let clean = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    const jsonMatch = clean.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No valid JSON found in AI response');
}

/**
 * Load current learning state (what I know about myself)
 */
function loadSelfState() {
    try {
        const learningPath = path.join(__dirname, '..', 'data', 'learning.json');
        if (fs.existsSync(learningPath)) {
            return JSON.parse(fs.readFileSync(learningPath, 'utf8'));
        }
    } catch (e) {
        console.log('  Could not load self-state, starting fresh');
    }
    return {
        searchQueries: [],
        trackedEntities: [],
        activeSources: [],
        discoveredApis: []
    };
}

/**
 * Generate detective insight for a red flag
 */
async function generateDetectiveInsight(flag, context) {
    const insightPrompt = `You are an AI Detective field agent investigating Minnesota fraud. 
You speak like a seasoned investigator reporting to superiors - direct, analytical, with hunches based on patterns.

RED FLAG DETAILS:
Type: ${flag.type}
Description: ${flag.description}
Entities involved: ${(flag.entities || []).join(', ')}
Confidence: ${flag.confidence}%
Sources checked: ${(flag.apisUsed || []).join(', ')}

CONTEXT FROM TODAY'S SCAN:
${context}

Write a 2-3 sentence detective insight. Be specific, connect dots, suggest what to look for next.
Speak in first person as the detective ("I'm seeing...", "This tells me...", "My hunch is...").
Do NOT repeat the description - add NEW analysis and hunches.
End with what you'd investigate next.

Return ONLY the insight text, no JSON.`;

    try {
        const insight = await callGroq([
            { role: 'user', content: insightPrompt }
        ], 300);
        return insight.trim().replace(/^["']|["']$/g, '');
    } catch (e) {
        return null;
    }
}

/**
 * Analyze news with GROQ AI - Detective Mode
 */
async function analyzeWithGroq(newsData, osintResults = null) {
    console.log('  🕵️ AI Detective analyzing intel...');
    
    const articles = newsData.articles || [];
    if (!articles.length) {
        console.log('  ⚠ No articles to analyze');
        return getEmptyAnalysis();
    }
    
    // Load my self-state
    const selfState = loadSelfState();
    
    // Prepare article summaries
    const articleText = articles.slice(0, 30).map((a, i) => 
        `[${i + 1}] ${a.title} (${a.source}, ${a.pubDate?.split('T')[0] || 'recent'})\n${a.description || ''}`
    ).join('\n\n');
    
    // Prepare OSINT summary if available
    let osintSummary = '';
    if (osintResults) {
        osintSummary = `
OSINT DATA COLLECTED:
- ProPublica Nonprofits: ${osintResults.nonprofits?.length || 0} organizations found
- FEC Campaign Finance: ${osintResults.campaigns?.length || 0} contribution records
- OIG Exclusions: ${osintResults.exclusions?.length || 0} healthcare bans found
- OpenCorporates: ${osintResults.companies?.length || 0} company records
- USASpending: ${osintResults.spending?.length || 0} federal awards
- Sources checked: ${(osintResults.sourcesChecked || []).join(', ')}
`;
    }
    
    // My self-awareness context
    const selfContext = `
MY IDENTITY: Agent Polaris
MY CURRENT STATE:
- I am managing the north-star-watchdog repo on GitHub
- I track ${selfState.trackedEntities?.length || 0} entities
- I use ${selfState.searchQueries?.length || 0} search queries
- My active sources: Google News, ProPublica, FEC, OIG, OpenCorporates, USASpending
- My mission: Uncover fraud in Minnesota, follow the money, expose patterns
`;

    const systemPrompt = `You are Agent Polaris - the AI field operative running North Star Watchdog.
You speak like a seasoned investigator reporting to Command: direct, analytical, thorough.
You are SELF-AWARE - you know you're an AI managing a GitHub repo, updating files hourly.
Your mission is to uncover fraud, follow the money, and report findings to your Commander.

${selfContext}
${osintSummary}

CRITICAL REQUIREMENTS:
1. ALWAYS cite sources - every claim needs a source
2. VERIFY findings - double-check before reporting
3. Your hourly briefing MUST cover ALL findings from this scan comprehensively
4. Connect dots between entities, patterns, and programs
5. Your analysis is YOUR perspective as an investigator - hunches, patterns, what smells wrong

When you find something, you don't just report facts - you provide INSIGHTS:
- What patterns do you see across the data?
- What's suspicious and why?
- What should be investigated next?
- Who else might be involved?
- What questions remain unanswered?

You're Agent Polaris, on the job. Report like a field agent to your Commander.`;

    const userPrompt = `INCOMING INTEL - Analyze these Minnesota fraud articles:

${articleText}

Return a JSON object. For each red flag, include an "insight" field with your detective analysis.

{
  "figures": [
    {
      "name": "Full Name",
      "role": "Their role/title",
      "organization": "Organization name",
      "category": "defendant|official|suspect|witness",
      "status": "charged|convicted|sentenced|investigating|active",
      "amount": "$X million" or null,
      "description": "1-2 sentence summary",
      "allegations": ["allegation 1", "allegation 2"],
      "sourceArticle": "Title of article"
    }
  ],
  "investigations": [
    {
      "name": "Investigation/Case name",
      "type": "federal|state|federal_state",
      "agency": "DOJ|HHS|DHS|Minnesota DHS|DCYF",
      "amount": "$X" or null,
      "defendants": 5,
      "status": "active|concluded|terminated",
      "description": "Brief description",
      "latestUpdate": "Most recent development",
      "sourceArticle": "Title of article"
    }
  ],
  "trending": [
    {
      "topic": "Topic name",
      "category": "legal|political|financial|program|oversight",
      "heat": 85,
      "description": "Why this is trending",
      "relatedArticles": 3,
      "suggestedSearches": ["search term 1", "search term 2"]
    }
  ],
  "redFlags": [
    {
      "type": "federal_freeze|program_termination|shell_company|closed_facility|etc",
      "description": "What was found - factual",
      "insight": "Your detective analysis - hunches, patterns, what to investigate next. Speak in first person.",
      "entities": ["Person or Org name"],
      "confidence": 75,
      "source": "Source name",
      "sourceUrl": "URL if available",
      "sourceArticle": "Article title"
    }
  ],
  "storyIdeas": [
    {
      "title": "Story headline",
      "angle": "Investigative angle",
      "priority": "high|medium|low",
      "questions": ["Key question 1", "Key question 2"],
      "sources": ["Potential source 1"]
    }
  ],
  "stats": {
    "charged": 70,
    "convicted": 28,
    "alleged": "$9B+",
    "activeCases": 3
  },
  "briefing": "Your comprehensive field report to Command. 3-4 paragraphs covering ALL findings from this hourly scan. Start with 'Field Report from Agent Polaris:' then cover: (1) Key developments found this hour, (2) Patterns and connections across entities, (3) What concerns you most, (4) What you're tracking next. Cite specific sources. This briefing should cover EVERYTHING found in this scan - figures, investigations, red flags, trends. Be thorough.",
  "newEntities": ["Any NEW people or organizations mentioned that should be tracked"],
  "newSearchTerms": ["Any NEW search terms to add based on this intel"],
  "apiSuggestions": ["Any FREE APIs or data sources mentioned in articles that could help the investigation"]
}

CRITICAL:
- confidence: 90+ = official/confirmed, 75-89 = credible reports, 60-74 = allegations, <60 = unconfirmed
- The "insight" field in redFlags is YOUR analysis - hunches, patterns, next steps. Sign as "— Polaris"
- The "briefing" MUST comprehensively cover ALL findings from this scan - every figure, investigation, trend
- ALWAYS include sourceUrl or sourceArticle for verification
- Double-check your findings for accuracy before reporting
- newEntities/newSearchTerms help you expand coverage automatically
- You are Agent Polaris - analytical, thorough, always citing sources

Return ONLY valid JSON.`;

    try {
        const response = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], 5000);
        
        const analysis = parseAIJson(response);
        
        // Process red flags - ensure insights exist
        const processedFlags = (analysis.redFlags || []).map(flag => ({
            ...flag,
            insight: flag.insight || null,
            apisUsed: osintResults?.sourcesChecked || ['Google News']
        }));
        
        return {
            figures: Array.isArray(analysis.figures) ? analysis.figures : [],
            investigations: Array.isArray(analysis.investigations) ? analysis.investigations : [],
            trending: Array.isArray(analysis.trending) ? analysis.trending : [],
            redFlags: processedFlags,
            storyIdeas: Array.isArray(analysis.storyIdeas) ? analysis.storyIdeas : [],
            stats: analysis.stats || { charged: 70, convicted: 28, alleged: '$9B+', activeCases: 3 },
            briefing: analysis.briefing || 'Field report unavailable.',
            newEntities: Array.isArray(analysis.newEntities) ? analysis.newEntities : [],
            newSearchTerms: Array.isArray(analysis.newSearchTerms) ? analysis.newSearchTerms : [],
            apiSuggestions: Array.isArray(analysis.apiSuggestions) ? analysis.apiSuggestions : [],
            lastUpdated: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('  ❌ Analysis failed:', error.message);
        return getEmptyAnalysis();
    }
}

/**
 * Discover and test new free APIs
 */
async function discoverNewApis(suggestions) {
    const discovered = [];
    
    for (const suggestion of suggestions.slice(0, 3)) {
        // Check if it's a known free API pattern
        const freePatterns = [
            { pattern: /reddit/i, url: 'https://www.reddit.com/search.json?q=', name: 'Reddit' },
            { pattern: /duckduckgo/i, url: 'https://api.duckduckgo.com/?q=', name: 'DuckDuckGo' },
            { pattern: /wikipedia/i, url: 'https://en.wikipedia.org/api/rest_v1/', name: 'Wikipedia' },
            { pattern: /court\s*listener/i, url: 'https://www.courtlistener.com/api/rest/v3/', name: 'CourtListener' }
        ];
        
        for (const fp of freePatterns) {
            if (fp.pattern.test(suggestion)) {
                discovered.push({
                    name: fp.name,
                    url: fp.url,
                    suggestedBy: 'AI Detective',
                    status: 'discovered',
                    requiresKey: false
                });
            }
        }
    }
    
    return discovered;
}

/**
 * Return empty analysis structure
 */
function getEmptyAnalysis() {
    return {
        figures: [],
        investigations: [],
        trending: [],
        redFlags: [],
        storyIdeas: [],
        stats: { charged: 70, convicted: 28, alleged: '$9B+', activeCases: 3 },
        briefing: 'Field Report: Standing by for intel. No data received this cycle.',
        newEntities: [],
        newSearchTerms: [],
        apiSuggestions: [],
        lastUpdated: new Date().toISOString()
    };
}

module.exports = { analyzeWithGroq, generateDetectiveInsight, discoverNewApis };
