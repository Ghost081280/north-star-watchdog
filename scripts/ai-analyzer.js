/**
 * NORTH STAR WATCHDOG - AI ANALYZER
 * Handles all GROQ AI analysis and intelligence extraction
 */

const https = require('https');
const fs = require('fs');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

/**
 * Call Groq AI API
 */
async function callGroqAI(prompt, maxTokens = 3000) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: maxTokens
        });
        
        const options = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GROQ_API_KEY}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    if (json.choices && json.choices[0]) {
                        resolve(json.choices[0].message.content);
                    } else if (json.error) {
                        reject(new Error(json.error.message || 'Groq API error'));
                    } else {
                        reject(new Error('No response from Groq'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('Groq API timeout'));
        });
        req.write(data);
        req.end();
    });
}

/**
 * Load current data for context
 */
function loadCurrentData() {
    const load = (file) => {
        try {
            return JSON.parse(fs.readFileSync(`data/${file}`, 'utf8'));
        } catch {
            return null;
        }
    };
    
    return {
        figures: load('figures.json')?.people?.map(p => p.name) || [],
        investigations: load('investigations.json')?.cases?.map(c => c.name) || [],
        highRiskPrograms: load('high-risk-programs.json')?.programs || [],
        searchTerms: load('search-terms.json')?.terms || []
    };
}

/**
 * Analyze news articles with AI
 */
async function analyzeNews(articles) {
    console.log('  Sending to Groq AI for analysis...');
    
    const currentData = loadCurrentData();
    
    const articleSummary = articles.slice(0, 25).map((a, i) => 
        `${i+1}. "${a.title}" (${a.source}, ${a.date})`
    ).join('\n');
    
    const prompt = `You are an AI editor for a Minnesota fraud investigation tracking website that updates HOURLY. Analyze these recent news articles and provide structured updates.

RECENT NEWS ARTICLES:
${articleSummary}

CURRENT TRACKED INVESTIGATIONS:
- Feeding Our Future ($250M, 78 indicted, 57+ convicted)
- CCAP Daycare Fraud ($1B+ estimated, 62+ investigations)
- EIDBI Autism Services ($220M+, 2 charged)
- Housing Stabilization ($302M, program terminated)

CURRENT KEY FIGURES: ${currentData.figures.join(', ') || 'None tracked yet'}

HIGH-RISK PROGRAMS BEING MONITORED: ${currentData.highRiskPrograms.join(', ') || 'None'}

Based on the news, provide a JSON response with these sections:

{
  "breaking": {
    "title": "Most important headline (rewrite concisely)",
    "source": "Source name",
    "link": "URL if available or empty string",
    "importance": "Why this matters in 1 sentence"
  },
  "trending": [
    {
      "topic": "Topic name (short)",
      "reason": "Why trending now",
      "suggestedSearches": ["search term 1", "search term 2", "search term 3"],
      "isNew": true
    }
  ],
  "investigationUpdates": [
    {
      "name": "Investigation name",
      "update": "What's new",
      "sourceUrl": "URL to source",
      "isNew": false
    }
  ],
  "figureUpdates": [
    {
      "name": "Person name",
      "role": "Their role",
      "update": "Status change or new development",
      "status": "investigating|charged|convicted|sentenced|cleared",
      "sourceUrl": "URL to source",
      "isNew": false
    }
  ],
  "newSearchTerms": ["new term to monitor", "another new term"],
  "newHighRiskPrograms": ["program name if discovered"],
  "redFlags": [
    {
      "type": "pattern_type",
      "description": "What was detected",
      "entities": ["entity names"],
      "sourceUrl": "URL",
      "priority": "high|medium|low"
    }
  ],
  "storyIdeas": [
    {
      "title": "Investigation angle headline",
      "description": "Brief description",
      "searches": ["related search 1", "related search 2"],
      "badge": "Follow Up|Breaking|Pattern|Connection",
      "isNew": true
    }
  ],
  "stats": {
    "charged": 93,
    "convicted": 57,
    "alleged": "$9B+"
  },
  "briefing": "A 2-3 sentence summary of TODAY's key developments. Start with 'Good morning/afternoon.' Be direct about what's happening NOW.",
  "entitiesForOsint": ["domain.com", "Organization Name", "Person Name"]
}

IMPORTANT RULES:
- Only include REAL updates from the news articles
- Set isNew=true only if this is genuinely NEW (not in our current lists)
- ALWAYS include sourceUrl when possible - link to the actual news source
- Be conservative - don't make up information
- trending should have 3-5 items, newest/hottest first
- storyIdeas should have 2-4 actionable investigation angles
- Update stats only if news CONFIRMS new numbers
- briefing should be what a visitor needs to know RIGHT NOW
- newSearchTerms: names, orgs, or terms mentioned that we should monitor
- redFlags: patterns you detect (same address, explosive growth, connections)
- entitiesForOsint: domains, org names, or people names worth deep investigation
- Return ONLY valid JSON, no markdown, no other text`;

    try {
        const response = await callGroqAI(prompt);
        
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log('  AI analysis complete');
            return parsed;
        }
        throw new Error('No JSON found in response');
    } catch (error) {
        console.error('  AI Analysis error:', error.message);
        return null;
    }
}

/**
 * Get AI analysis for a specific entity (for OSINT enrichment)
 */
async function analyzeEntity(entityName, context) {
    const prompt = `Analyze this entity in the context of Minnesota fraud investigations:

ENTITY: ${entityName}
CONTEXT: ${context}

Provide a brief JSON response:
{
  "riskLevel": "high|medium|low|unknown",
  "connections": ["known connections"],
  "suggestedSearches": ["what to look for"],
  "notes": "brief analysis"
}

Return ONLY valid JSON.`;

    try {
        const response = await callGroqAI(prompt, 500);
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
    } catch {
        return null;
    }
}

module.exports = {
    analyzeNews,
    analyzeEntity,
    callGroqAI
};
