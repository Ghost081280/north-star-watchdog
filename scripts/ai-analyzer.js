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
 * REQUIRES: GROQ_API_KEY environment variable
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

/**
 * GROQ Models - ordered by preference with context limits
 * Will auto-fallback if rate limited
 * Updated: Jan 2026 - removed decommissioned models
 */
const GROQ_MODELS = [
    { name: 'llama-3.3-70b-versatile', contextLimit: 32000, articleLimit: 30 },
    { name: 'llama3-70b-8192', contextLimit: 8192, articleLimit: 15 },
    { name: 'mixtral-8x7b-32768', contextLimit: 32768, articleLimit: 30 },
    { name: 'llama-3.1-8b-instant', contextLimit: 8192, articleLimit: 10 },
    { name: 'gemma2-9b-it', contextLimit: 8192, articleLimit: 10 }
];

let currentModelIndex = 0;

/**
 * Get current model config
 */
function getCurrentModelConfig() {
    return GROQ_MODELS[currentModelIndex];
}

/**
 * Call GROQ API with automatic model fallback
 */
async function callGroq(messages, maxTokens = 4000, retryCount = 0) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    
    const modelConfig = GROQ_MODELS[currentModelIndex];
    const model = modelConfig.name;
    
    const body = JSON.stringify({
        model,
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
            res.on('end', async () => {
                try {
                    const json = JSON.parse(data);
                    
                    // Check for errors
                    if (json.error) {
                        const errorMsg = json.error.message || '';
                        
                        // Rate limit or token limit hit - try next model
                        if (errorMsg.includes('Rate limit') || 
                            errorMsg.includes('rate_limit') || 
                            errorMsg.includes('Request too large') ||
                            errorMsg.includes('tokens per minute') ||
                            res.statusCode === 429) {
                            
                            console.log(`  ⚠️ ${errorMsg.includes('Request too large') ? 'Token limit' : 'Rate limit'} hit on ${model}`);
                            
                            // Try next model if available
                            if (currentModelIndex < GROQ_MODELS.length - 1) {
                                currentModelIndex++;
                                console.log(`  🔄 Switching to fallback model: ${GROQ_MODELS[currentModelIndex].name}`);
                                
                                // Signal that we need to retry with reduced data
                                reject(new Error(`RETRY_WITH_SMALLER_CONTEXT:${GROQ_MODELS[currentModelIndex].articleLimit}`));
                                return;
                            } else {
                                reject(new Error(`All models exhausted. Try again later.`));
                                return;
                            }
                        }
                        
                        reject(new Error(errorMsg));
                        return;
                    }
                    
                    resolve(json.choices?.[0]?.message?.content || '');
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
 * Get current model being used
 */
function getCurrentModel() {
    return GROQ_MODELS[currentModelIndex].name;
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
 * Analyze news with GROQ AI - Detective Mode
 * Now handles automatic retry with reduced data for smaller models
 */
async function analyzeWithGroq(newsData, osintResults = null, articleLimit = null) {
    console.log('  🕵️ AI Detective analyzing intel...');
    
    const articles = newsData.articles || [];
    if (!articles.length) {
        console.log('  ⚠ No articles to analyze');
        return getEmptyAnalysis();
    }
    
    // Load my self-state
    const selfState = loadSelfState();
    
    // Determine article limit based on current model or override
    const modelConfig = getCurrentModelConfig();
    const limit = articleLimit || modelConfig.articleLimit || 30;
    const isSmallModel = modelConfig.contextLimit <= 8192;
    console.log(`  📊 Using ${limit} articles for ${modelConfig.name}${isSmallModel ? ' (compact mode)' : ''}`);
    
    // Prepare article summaries with dynamic limit
    // For small models, use shorter summaries
    const articleText = articles.slice(0, limit).map((a, i) => {
        if (isSmallModel) {
            // Compact format for small models
            return `[${i + 1}] ${a.title} (${a.source})`;
        }
        return `[${i + 1}] ${a.title} (${a.source}, ${a.pubDate?.split('T')[0] || 'recent'})\n${a.description || ''}`;
    }).join('\n');
    
    // Prepare OSINT summary if available (compact for small models)
    let osintSummary = '';
    if (osintResults && !isSmallModel) {
        osintSummary = `
OSINT DATA COLLECTED:
- ProPublica Nonprofits: ${osintResults.nonprofits?.length || 0} organizations found
- FEC Campaign Finance: ${osintResults.campaigns?.length || 0} contribution records
- OIG Exclusions: ${osintResults.exclusions?.length || 0} healthcare bans found
- OpenCorporates: ${osintResults.companies?.length || 0} company records
- USASpending: ${osintResults.spending?.length || 0} federal awards
- Sources checked: ${(osintResults.sourcesChecked || []).join(', ')}
- Sources with data: ${(osintResults.sourcesUsed || []).join(', ')}
`;
    }
    
    // My self-awareness context (skip for small models)
    const selfContext = isSmallModel ? '' : `
MY IDENTITY: Agent Polaris
MY CURRENT STATE:
- I am managing the north-star-watchdog repo on GitHub
- I track ${selfState.trackedEntities?.length || 0} entities
- I use ${selfState.searchQueries?.length || 0} search queries
- My active sources: Google News, ProPublica, FEC, OIG, OpenCorporates, USASpending
- My mission: Uncover fraud in Minnesota, follow the money, expose patterns
`;

    // Use compact prompt for small models
    const systemPrompt = isSmallModel 
        ? `You are Agent Polaris, an AI fraud investigator. Analyze Minnesota fraud news and return JSON with: figures (people charged), investigations (cases), trending (topics), redFlags (concerns), storyIdeas, stats, briefing. Be concise.`
        : `You are Agent Polaris - the AI field operative running North Star Watchdog.
You speak like a seasoned investigator reporting to Command: direct, analytical, thorough.
Your mission is to uncover fraud, follow the money, and report findings to your Commander.

${selfContext}
${osintSummary}

CRITICAL REQUIREMENTS:
1. ALWAYS cite sources - every claim needs a source
2. VERIFY findings - double-check before reporting
3. Your hourly briefing MUST synthesize ALL findings comprehensively - not just breaking news
4. Connect dots between entities, patterns, and programs
5. Your analysis is YOUR perspective as an investigator - hunches, patterns, what smells wrong`;

    // Compact prompt for small models to stay under token limit
    const compactUserPrompt = `Analyze these Minnesota fraud headlines and return JSON:

${articleText}

Return JSON with: figures (charged people), investigations (cases with sourceUrl), trending (topics), redFlags, storyIdeas, stats (charged/convicted/alleged counts), briefing (2 paragraph summary), newEntities, newSearchTerms.

RULES: Only include people actually CHARGED. investigations MUST have real https:// sourceUrl. Keep responses concise.`;

    const fullUserPrompt = `INCOMING INTEL - Analyze these Minnesota fraud articles:

${articleText}

Return a JSON object with your analysis.

CRITICAL: The "briefing" field must be a comprehensive 3-4 paragraph field report that:
1. Synthesizes ALL findings from this scan (not just the top headline)
2. Covers: new developments, patterns across entities, concerns, next steps
3. Mentions specific figures, amounts, and sources
4. Reads like an intelligence briefing, not a news summary

{
  "figures": [
    {
      "name": "Full Name",
      "role": "Their role/title",
      "organization": "Organization name",
      "status": "charged|convicted|sentenced|indicted",
      "allegations": ["Wire fraud", "Money laundering"],
      "sourceArticle": "Title of article"
    }
  ],
  "investigations": [
    {
      "name": "Investigation/Case name",
      "agency": "DOJ|HHS|Minnesota DHS",
      "amount": "$X",
      "status": "active|concluded",
      "description": "Brief description",
      "latestUpdate": "Most recent development",
      "sourceUrl": "https://actual-source-url.com",
      "searches": ["search term 1", "search term 2"]
    }
  ],
  "trending": [
    {
      "topic": "Topic name",
      "heat": 85,
      "description": "Why this is trending - 2-3 sentences explaining the significance",
      "reason": "Short reason for trending",
      "suggestedSearches": ["search 1", "search 2"],
      "isNew": true
    }
  ],
  "redFlags": [
    {
      "type": "federal_freeze|program_termination|shell_company|etc",
      "description": "What was found - factual",
      "insight": "Your detective analysis in first person. What patterns you see, what to investigate next.",
      "entities": ["Person or Org name"],
      "confidence": 75,
      "priority": "high|medium|low",
      "source": "Source name",
      "sourceUrl": "https://url"
    }
  ],
  "storyIdeas": [
    {
      "title": "Story headline",
      "description": "What this story would investigate",
      "angle": "The specific investigative angle",
      "badge": "Follow the Money|Data Analysis|Public Records|Whistleblower",
      "priority": "high|medium|low",
      "questions": ["Key question 1", "Key question 2"],
      "searches": ["search term 1", "search term 2"],
      "insight": "AI Detective's take on why this story matters and how to approach it",
      "isNew": true
    }
  ],
  "stats": {
    "charged": 70,
    "convicted": 28,
    "alleged": "$9B+",
    "activeCases": 5
  },
  "briefing": "Field Report from Agent Polaris: [Your comprehensive 3-4 paragraph synthesis of ALL findings. Cover: (1) Key developments found this hour across all sources, (2) Patterns and connections between entities/programs, (3) What concerns you most and why, (4) What you're tracking next. Be specific with names, amounts, sources. This is your intelligence briefing to Command - make it thorough.]",
  "newEntities": ["NEW people/orgs to track"],
  "newSearchTerms": ["NEW search terms to add"]
}

RULES:
- figures: ONLY people actually CHARGED with crimes. Must have specific allegations.
- NEVER add journalists (Nick Shirley reports on fraud - he's a SOURCE not suspect)
- investigations: MUST have real sourceUrl starting with https://
- trending: Include "description" with 2-3 sentences AND "reason" with short summary
- storyIdeas: Include "insight" with AI detective analysis AND "searches" for research
- briefing: MUST be comprehensive synthesis, NOT just the top headline
- Stats baseline: charged>=70, convicted>=28, alleged>=$9B+

Return ONLY valid JSON.`;

    // Select the appropriate prompt based on model size
    const userPrompt = isSmallModel ? compactUserPrompt : fullUserPrompt;

    try {
        const response = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ], isSmallModel ? 2000 : 5000);
        
        const analysis = parseAIJson(response);
        
        // Process red flags - DO NOT set apisUsed here
        // Let ai-files.js handle it with proper per-entity source tracking
        const processedFlags = (analysis.redFlags || []).map(flag => ({
            ...flag,
            insight: flag.insight || null
            // apisUsed will be set by ai-files.js using getSourcesForRedFlag()
        }));
        
        return {
            figures: Array.isArray(analysis.figures) ? analysis.figures : [],
            investigations: Array.isArray(analysis.investigations) ? analysis.investigations : [],
            trending: Array.isArray(analysis.trending) ? analysis.trending : [],
            redFlags: processedFlags,
            storyIdeas: Array.isArray(analysis.storyIdeas) ? analysis.storyIdeas : [],
            stats: analysis.stats || { charged: 70, convicted: 28, alleged: '$9B+', activeCases: 5 },
            briefing: analysis.briefing || 'Field report unavailable.',
            newEntities: Array.isArray(analysis.newEntities) ? analysis.newEntities : [],
            newSearchTerms: Array.isArray(analysis.newSearchTerms) ? analysis.newSearchTerms : [],
            lastUpdated: new Date().toISOString()
        };
        
    } catch (error) {
        // Check if we need to retry with smaller context
        if (error.message.startsWith('RETRY_WITH_SMALLER_CONTEXT:')) {
            const newLimit = parseInt(error.message.split(':')[1], 10);
            console.log(`  🔄 Retrying with ${newLimit} articles...`);
            return analyzeWithGroq(newsData, osintResults, newLimit);
        }
        
        console.error('  ❌ Analysis failed:', error.message);
        return getEmptyAnalysis();
    }
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
        stats: { charged: 70, convicted: 28, alleged: '$9B+', activeCases: 5 },
        briefing: 'Field Report: Standing by for intel. No data received this cycle.',
        newEntities: [],
        newSearchTerms: [],
        lastUpdated: new Date().toISOString()
    };
}

module.exports = { analyzeWithGroq };
