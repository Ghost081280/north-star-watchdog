/**
 * NORTH STAR WATCHDOG - AI SITE UPDATER (ENHANCED)
 * 
 * This script runs hourly via GitHub Actions:
 * 1. Scrapes Google News RSS for Minnesota fraud stories
 * 2. Sends to Groq AI for analysis
 * 3. AI identifies: breaking news, trending topics, new figures, investigation updates
 * 4. Updates all JSON data files
 * 5. Expands search terms and tracks high-risk programs dynamically
 * 
 * REQUIRES: GROQ_API_KEY as GitHub Secret
 * COST: FREE (Groq free tier = 14,400 requests/day)
 */

const https = require('https');
const fs = require('fs');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Base search terms (AI expands this list)
const BASE_SEARCH_TERMS = [
    'Minnesota fraud',
    'Feeding Our Future',
    'Minnesota welfare fraud', 
    'Tim Walz investigation',
    'Minnesota daycare fraud CCAP',
    'Keith Ellison fraud',
    'Minnesota Medicaid fraud',
    'Minnesota DHS fraud',
    'Aimee Bock',
    'Ilhan Omar husband'
];

// Base high-risk programs
const BASE_HIGH_RISK_PROGRAMS = [
    'EIDBI',
    'Housing Stabilization Services',
    'Integrated Community Supports',
    'Nonemergency Medical Transportation',
    'Peer Recovery Services',
    'Adult Rehabilitative Mental Health Services',
    'Personal Care Assistance'
];

// ============================================
// DATA LOADING/SAVING
// ============================================

function loadCurrentData(filename) {
    try {
        return JSON.parse(fs.readFileSync(`data/${filename}`, 'utf8'));
    } catch {
        return null;
    }
}

function saveData(filename, data) {
    fs.writeFileSync(`data/${filename}`, JSON.stringify(data, null, 2));
    console.log(`Saved ${filename}`);
}

// ============================================
// GOOGLE NEWS RSS SCRAPER
// ============================================

async function fetchGoogleNews(searchTerm) {
    return new Promise((resolve, reject) => {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchTerm)}&hl=en-US&gl=US&ceid=US:en`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const items = [];
                    const itemMatches = data.match(/<item>([\s\S]*?)<\/item>/g) || [];
                    
                    for (const item of itemMatches.slice(0, 5)) {
                        const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
                        const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
                        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
                        
                        let cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '');
                        const dashIdx = cleanTitle.lastIndexOf(' - ');
                        const source = dashIdx > -1 ? cleanTitle.substring(dashIdx + 3) : 'Unknown';
                        cleanTitle = dashIdx > -1 ? cleanTitle.substring(0, dashIdx) : cleanTitle;
                        
                        items.push({
                            title: cleanTitle,
                            source,
                            link,
                            date: pubDate ? new Date(pubDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
                            searchTerm
                        });
                    }
                    resolve(items);
                } catch (e) {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

async function scrapeAllNews() {
    console.log('Scraping Google News RSS...');
    
    // Load dynamic search terms or use base
    const searchTermsData = loadCurrentData('search-terms.json') || { terms: BASE_SEARCH_TERMS };
    const SEARCH_TERMS = searchTermsData.terms.slice(0, 20); // Limit to prevent rate limiting
    
    const allArticles = [];
    
    for (const term of SEARCH_TERMS) {
        const articles = await fetchGoogleNews(term);
        allArticles.push(...articles);
        console.log(`  - "${term}": ${articles.length} articles`);
    }
    
    // Deduplicate
    const seen = new Set();
    const unique = allArticles.filter(a => {
        const key = a.title.toLowerCase().substring(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    console.log(`Total unique articles: ${unique.length}`);
    return unique;
}

// ============================================
// GROQ AI ANALYSIS
// ============================================

async function callGroqAI(prompt) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            model: GROQ_MODEL,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 3000
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
                    } else {
                        reject(new Error('No response from Groq'));
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function analyzeWithAI(articles) {
    console.log('Sending to Groq AI for analysis...');
    
    // Load current data for context
    const currentFigures = loadCurrentData('figures.json')?.people?.map(p => p.name) || [];
    const currentCases = loadCurrentData('investigations.json')?.cases?.map(c => c.name) || [];
    const highRiskPrograms = loadCurrentData('high-risk-programs.json')?.programs || BASE_HIGH_RISK_PROGRAMS;
    
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

CURRENT KEY FIGURES: ${currentFigures.join(', ')}

HIGH-RISK PROGRAMS BEING MONITORED: ${highRiskPrograms.join(', ')}

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
      "type": "flag_type",
      "description": "What was detected",
      "entities": ["entity names"],
      "sourceUrl": "URL"
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
  "briefing": "IMPORTANT: Check the current hour. If 0-11 CST say 'Good morning', if 12-16 say 'Good afternoon', if 17-23 say 'Good evening'. Then be SASSY and engaging - like 'You're NOT gonna believe this...' or 'Holy smokes!' or 'While you were sleeping...' End with something fun like 'The robots never sleep. 🤖' Keep it 2-3 punchy sentences."
}

IMPORTANT RULES:
- Only include REAL updates from the news articles
- Set isNew=true only if this is genuinely NEW (not in our current lists)
- ALWAYS include sourceUrl when possible - link to the actual news source
- Be conservative - don't make up information
- trending should have 3-5 items, newest/hottest first
- storyIdeas should have 2-4 actionable investigation angles
- Update stats only if news CONFIRMS new numbers
- briefing: USE CORRECT GREETING FOR TIME OF DAY (morning/afternoon/evening based on CST). Be SASSY - you're an AI Detective with personality! Say things like "You're not gonna believe this..." or "Holy smokes!" Make it FUN and engaging, not boring corporate speak. End with "The robots never sleep. 🤖" or similar.
- newSearchTerms: names, orgs, or terms mentioned that we should monitor
- redFlags: patterns you detect (same address, explosive growth, connections)
- Return ONLY valid JSON, no markdown, no other text`;

    try {
        const response = await callGroqAI(prompt);
        
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        throw new Error('No JSON found in response');
    } catch (error) {
        console.error('AI Analysis error:', error.message);
        return null;
    }
}

// ============================================
// DATA FILE UPDATERS
// ============================================

async function updateAllData(articles, aiAnalysis) {
    const timestamp = new Date().toISOString();
    
    // 1. Update news.json
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
    const trendingTopics = aiAnalysis?.trending || [];
    trendingTopics.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    const trendingData = {
        topics: trendingTopics,
        lastUpdated: timestamp
    };
    saveData('trending.json', trendingData);
    
    // 3. Update investigations.json
    let investigations = loadCurrentData('investigations.json') || { cases: [], lastUpdated: '' };
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
    let figures = loadCurrentData('figures.json') || { people: [], lastUpdated: '' };
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
    // Sort NEW first
    figures.people.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    figures.lastUpdated = timestamp;
    saveData('figures.json', figures);
    
    // 5. Update story-ideas.json (sort NEW first)
    const storyIdeas = aiAnalysis?.storyIdeas || [];
    storyIdeas.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    const storyIdeasData = {
        ideas: storyIdeas.slice(0, 8),
        lastUpdated: timestamp
    };
    saveData('story-ideas.json', storyIdeasData);
    
    // 6. Update stats.json with AI briefing
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
    
    console.log('All data files updated!');
}

// ============================================
// DYNAMIC TRACKING UPDATERS
// ============================================

async function updateSearchTerms(aiAnalysis) {
    let data = loadCurrentData('search-terms.json') || { terms: BASE_SEARCH_TERMS };
    
    if (aiAnalysis?.newSearchTerms?.length > 0) {
        const newTerms = aiAnalysis.newSearchTerms.filter(t => 
            t && !data.terms.some(existing => 
                existing.toLowerCase() === t.toLowerCase()
            )
        );
        if (newTerms.length > 0) {
            data.terms = [...newTerms, ...data.terms].slice(0, 50); // Keep 50, newest first
            console.log(`Added new search terms: ${newTerms.join(', ')}`);
        }
    }
    
    data.lastUpdated = new Date().toISOString();
    saveData('search-terms.json', data);
}

async function updateHighRiskPrograms(aiAnalysis) {
    let data = loadCurrentData('high-risk-programs.json') || { programs: BASE_HIGH_RISK_PROGRAMS };
    
    if (aiAnalysis?.newHighRiskPrograms?.length > 0) {
        const newProgs = aiAnalysis.newHighRiskPrograms.filter(p => 
            p && !data.programs.some(existing => 
                existing.toLowerCase() === p.toLowerCase()
            )
        );
        if (newProgs.length > 0) {
            data.programs.push(...newProgs);
            console.log(`Added new high-risk programs: ${newProgs.join(', ')}`);
        }
    }
    
    data.lastUpdated = new Date().toISOString();
    saveData('high-risk-programs.json', data);
}

async function updateRedFlags(aiAnalysis) {
    let data = loadCurrentData('red-flags.json') || { flags: [], flagTypes: [] };
    
    if (aiAnalysis?.redFlags?.length > 0) {
        // Add timestamp to each flag
        const newFlags = aiAnalysis.redFlags.map(f => ({
            ...f,
            detectedAt: new Date().toISOString()
        }));
        
        // Prepend new flags, keep last 100
        data.flags = [...newFlags, ...data.flags].slice(0, 100);
        console.log(`Added ${newFlags.length} new red flags`);
    }
    
    data.lastUpdated = new Date().toISOString();
    saveData('red-flags.json', data);
}

// ============================================
// MAIN
// ============================================

async function main() {
    console.log('========================================');
    console.log('NORTH STAR WATCHDOG - AI UPDATER');
    console.log('========================================');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('');
    
    if (!GROQ_API_KEY) {
        console.error('ERROR: GROQ_API_KEY not set!');
        console.log('Add your FREE Groq API key to GitHub Secrets:');
        console.log('  Settings > Secrets > Actions > New secret');
        console.log('  Name: GROQ_API_KEY');
        console.log('  Get key: https://console.groq.com/keys');
        process.exit(1);
    }
    
    // Ensure data directory exists
    if (!fs.existsSync('data')) {
        fs.mkdirSync('data', { recursive: true });
    }
    
    // Step 1: Scrape news
    const articles = await scrapeAllNews();
    
    if (articles.length === 0) {
        console.log('No articles found, keeping existing data');
        process.exit(0);
    }
    
    // Step 2: AI analysis
    const aiAnalysis = await analyzeWithAI(articles);
    
    if (aiAnalysis) {
        console.log('AI Analysis complete:');
        console.log(`  - Breaking: ${aiAnalysis.breaking?.title || 'None'}`);
        console.log(`  - Trending topics: ${aiAnalysis.trending?.length || 0}`);
        console.log(`  - Investigation updates: ${aiAnalysis.investigationUpdates?.length || 0}`);
        console.log(`  - Figure updates: ${aiAnalysis.figureUpdates?.length || 0}`);
        console.log(`  - New search terms: ${aiAnalysis.newSearchTerms?.length || 0}`);
        console.log(`  - Red flags: ${aiAnalysis.redFlags?.length || 0}`);
        console.log(`  - Story ideas: ${aiAnalysis.storyIdeas?.length || 0}`);
    } else {
        console.log('AI analysis failed, using basic update');
    }
    
    // Step 3: Update all data files
    await updateAllData(articles, aiAnalysis);
    
    // Step 4: Update dynamic tracking files
    if (aiAnalysis) {
        await updateSearchTerms(aiAnalysis);
        await updateHighRiskPrograms(aiAnalysis);
        await updateRedFlags(aiAnalysis);
    }
    
    console.log('');
    console.log('========================================');
    console.log('UPDATE COMPLETE');
    console.log('========================================');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
