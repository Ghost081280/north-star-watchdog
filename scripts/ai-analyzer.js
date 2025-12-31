/**
 * NORTH STAR WATCHDOG - AI ANALYZER
 * 
 * Uses GROQ (free) to analyze news and extract:
 * - Key figures (people involved in fraud cases)
 * - Active investigations
 * - Trending topics
 * - Red flags (potential fraud indicators)
 * - Story ideas for journalists
 * - Stats (charged, convicted, amounts)
 * - AI briefing synthesis
 * 
 * REQUIRES: GROQ_API_KEY environment variable
 */

const https = require('https');

/**
 * Call GROQ API
 */
async function callGroq(messages, maxTokens = 4000) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');
    
    const body = JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages,
        max_tokens: maxTokens,
        temperature: 0.3
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
    // Remove markdown code blocks
    let clean = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
    
    // Find JSON object or array
    const jsonMatch = clean.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('No valid JSON found in AI response');
}

/**
 * Analyze news with GROQ AI
 */
async function analyzeWithGroq(newsData) {
    console.log('  Sending to GROQ for analysis...');
    
    const articles = newsData.articles || [];
    if (!articles.length) {
        console.log('  ⚠ No articles to analyze');
        return getEmptyAnalysis();
    }
    
    // Prepare article summaries for AI
    const articleText = articles.slice(0, 30).map((a, i) => 
        `[${i + 1}] ${a.title} (${a.source}, ${a.pubDate?.split('T')[0] || 'recent'})\n${a.description || ''}`
    ).join('\n\n');
    
    const systemPrompt = `You are an investigative journalist AI analyzing Minnesota fraud news. 
Your job is to extract REAL information from the articles provided - never make things up.
Only include information that is explicitly stated or strongly implied in the articles.`;

    const userPrompt = `Analyze these Minnesota fraud news articles and extract information.

ARTICLES:
${articleText}

Return a JSON object with these fields:

{
  "figures": [
    {
      "name": "Full Name",
      "role": "Their role/title",
      "organization": "Organization name",
      "status": "charged|convicted|sentenced|indicted|investigating|cleared",
      "amount": "$X million" or null,
      "description": "1-2 sentence summary",
      "sourceArticle": "Title of article this came from"
    }
  ],
  "investigations": [
    {
      "name": "Investigation/Case name",
      "type": "federal|state|ongoing",
      "amount": "$X" or null,
      "defendants": 5,
      "status": "active|concluded",
      "description": "Brief description",
      "sourceArticle": "Title of article"
    }
  ],
  "trending": [
    {
      "topic": "Topic name",
      "category": "legal|political|financial|program",
      "heat": 85,
      "description": "Why this is trending",
      "relatedArticles": 3
    }
  ],
  "redFlags": [
    {
      "type": "misappropriation|false_claims|kickbacks|shell_company|etc",
      "description": "What was found",
      "entities": ["Person or Org name"],
      "confidence": 75,
      "source": "Google News",
      "sourceUrl": "article URL if available",
      "sourceArticle": "Article title"
    }
  ],
  "storyIdeas": [
    {
      "title": "Story headline",
      "angle": "Investigative angle",
      "questions": ["Key question 1", "Key question 2"],
      "sources": ["Potential source 1"]
    }
  ],
  "stats": {
    "charged": 93,
    "convicted": 57,
    "alleged": "$9B",
    "activeCases": 4
  },
  "briefing": "A 2-3 paragraph synthesis of the most important developments across ALL the news. This should NOT just summarize one article - it should connect patterns, highlight key updates, and provide context about the overall state of Minnesota fraud investigations."
}

IMPORTANT:
- confidence scores: 90+ = official charges/convictions, 75-89 = credible reports, 60-74 = allegations, below 60 = unconfirmed
- Only include figures/investigations that are EXPLICITLY mentioned in the articles
- The briefing should synthesize ALL articles, not just repeat one headline
- For stats, use the ACTUAL numbers mentioned in the articles, or estimate based on cumulative reporting
- Be accurate - this is for journalists who will verify

Return ONLY valid JSON, no other text.`;

    try {
        const response = await callGroq([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]);
        
        const analysis = parseAIJson(response);
        
        // Validate and clean response
        return {
            figures: Array.isArray(analysis.figures) ? analysis.figures : [],
            investigations: Array.isArray(analysis.investigations) ? analysis.investigations : [],
            trending: Array.isArray(analysis.trending) ? analysis.trending : [],
            redFlags: Array.isArray(analysis.redFlags) ? analysis.redFlags : [],
            storyIdeas: Array.isArray(analysis.storyIdeas) ? analysis.storyIdeas : [],
            stats: analysis.stats || { charged: 0, convicted: 0, alleged: '$0', activeCases: 0 },
            briefing: analysis.briefing || 'No briefing generated.',
            lastUpdated: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('  ❌ GROQ analysis failed:', error.message);
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
        stats: { charged: 0, convicted: 0, alleged: '$0', activeCases: 0 },
        briefing: 'Analysis unavailable - no data to process.',
        lastUpdated: new Date().toISOString()
    };
}

module.exports = { analyzeWithGroq };
