/**
 * NORTH STAR WATCHDOG V4 - AI SITE UPDATER
 * 
 * This script runs hourly via GitHub Actions:
 * 1. Scrapes Google News RSS for Minnesota fraud stories
 * 2. Sends to Groq AI for analysis
 * 3. AI identifies: breaking news, trending topics, new figures, investigation updates
 * 4. Updates all JSON data files
 * 
 * REQUIRES: GROQ_API_KEY as GitHub Secret
 * COST: FREE (Groq free tier = 14,400 requests/day)
 */

const https = require('https');
const fs = require('fs');

// Configuration
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = 'llama-3.3-70b-versatile';

// Search terms to monitor
const SEARCH_TERMS = [
    'Minnesota fraud',
    'Feeding Our Future',
    'Minnesota welfare fraud', 
    'Tim Walz investigation',
    'Minnesota daycare fraud CCAP',
    'Keith Ellison fraud',
    'Minnesota Medicaid fraud',
    'Minnesota DHS fraud'
];

// Current known data (baseline for comparison)
const KNOWN_INVESTIGATIONS = ['Feeding Our Future', 'CCAP Daycare', 'EIDBI Autism', 'Housing Stabilization'];
const KNOWN_FIGURES = ['Tim Walz', 'Keith Ellison', 'Aimee Bock', 'Guhaad Said', 'Ilhan Omar'];

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
                    // Simple XML parsing for RSS
                    const items = [];
                    const itemMatches = data.match(/<item>([\s\S]*?)<\/item>/g) || [];
                    
                    for (const item of itemMatches.slice(0, 5)) {
                        const title = (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
                        const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
                        const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
                        
                        // Clean title (remove source suffix)
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
    console.log('📰 Scraping Google News RSS...');
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
    
    console.log(`✅ Total unique articles: ${unique.length}`);
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
            max_tokens: 2000
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
    console.log('🤖 Sending to Groq AI for analysis...');
    
    const articleSummary = articles.slice(0, 20).map((a, i) => 
        `${i+1}. "${a.title}" (${a.source}, ${a.date})`
    ).join('\n');
    
    const prompt = `You are an AI editor for a Minnesota fraud investigation tracking website. Analyze these recent news articles and provide structured updates.

RECENT NEWS ARTICLES:
${articleSummary}

CURRENT TRACKED INVESTIGATIONS:
- Feeding Our Future ($250M, 78 indicted, 57+ convicted)
- CCAP Daycare Fraud ($1B+ estimated, 62 investigations)
- EIDBI Autism Services ($220M+, 2 charged)
- Housing Stabilization ($302M, program terminated)

CURRENT KEY FIGURES:
- Tim Walz (Governor) - Under House Oversight investigation
- Keith Ellison (AG) - Under scrutiny
- Aimee Bock - Convicted (FOF mastermind)
- Guhaad Said - Pled guilty (Omar campaign)

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
      "topic": "Topic name",
      "reason": "Why trending now",
      "suggestedSearches": ["search term 1", "search term 2", "search term 3"]
    }
  ],
  "investigationUpdates": [
    {
      "name": "Investigation name",
      "update": "What's new",
      "isNew": false
    }
  ],
  "figureUpdates": [
    {
      "name": "Person name",
      "role": "Their role",
      "update": "Status change or new development",
      "status": "investigating|charged|convicted|cleared",
      "isNew": false
    }
  ],
  "newSearchTerms": ["new term to monitor", "another new term"],
  "storyIdeas": [
    {
      "title": "Investigation angle headline",
      "description": "Brief description",
      "searches": ["related search 1", "related search 2"],
      "badge": "Follow Up|Breaking|Pattern|Connection"
    }
  ],
  "stats": {
    "charged": 93,
    "convicted": 57,
    "alleged": "$9B+"
  },
  "briefing": "A 2-3 sentence summary of today's key developments for visitors. Start with 'Good morning/afternoon.' Be informative and direct about what's happening in the investigation."
}

IMPORTANT:
- Only include REAL updates from the news articles
- Set isNew=true only if this is a genuinely new investigation or figure not in our current list
- Be conservative - don't make up information
- trending should have 3-5 items
- storyIdeas should have 2-4 items based on patterns in the news
- Update stats.charged/convicted only if news confirms new numbers
- briefing should summarize the most important things a visitor should know TODAY
- Return ONLY valid JSON, no other text`;

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
function loadCurrentData(filename) {
    try {
        return JSON.parse(fs.readFileSync(`data/${filename}`, 'utf8'));
    } catch {
        return null;
    }
}

function saveData(filename, data) {
    fs.writeFileSync(`data/${filename}`, JSON.stringify(data, null, 2));
    console.log(`💾 Saved ${filename}`);
}

async function updateAllData(articles, aiAnalysis) {
    const timestamp = new Date().toISOString();
    
    // 1. Update news.json (raw articles)
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
    
    // 2. Update trending.json
    const trendingData = {
        topics: aiAnalysis?.trending || [
            { topic: 'FBI Agent Surge', reason: 'Kash Patel announces deployment', suggestedSearches: ['FBI Minnesota', 'Kash Patel'] }
        ],
        lastUpdated: timestamp
    };
    saveData('trending.json', trendingData);
    
    // 3. Update investigations.json (merge with existing)
    let investigations = loadCurrentData('investigations.json') || { cases: [], lastUpdated: '' };
    if (aiAnalysis?.investigationUpdates) {
        for (const update of aiAnalysis.investigationUpdates) {
            const existing = investigations.cases.find(c => c.name.toLowerCase().includes(update.name.toLowerCase()));
            if (existing) {
                existing.latestUpdate = update.update;
                existing.lastUpdated = timestamp;
            } else if (update.isNew) {
                investigations.cases.push({
                    name: update.name,
                    latestUpdate: update.update,
                    isNew: true,
                    addedDate: timestamp
                });
            }
        }
    }
    investigations.lastUpdated = timestamp;
    saveData('investigations.json', investigations);
    
    // 4. Update figures.json (merge with existing)
    let figures = loadCurrentData('figures.json') || { people: [], lastUpdated: '' };
    if (aiAnalysis?.figureUpdates) {
        for (const update of aiAnalysis.figureUpdates) {
            const existing = figures.people.find(p => p.name.toLowerCase() === update.name.toLowerCase());
            if (existing) {
                existing.latestUpdate = update.update;
                existing.status = update.status;
                existing.lastUpdated = timestamp;
            } else if (update.isNew) {
                figures.people.push({
                    name: update.name,
                    role: update.role,
                    status: update.status,
                    latestUpdate: update.update,
                    isNew: true,
                    addedDate: timestamp
                });
            }
        }
    }
    figures.lastUpdated = timestamp;
    saveData('figures.json', figures);
    
    // 5. Update story-ideas.json
    const storyIdeas = {
        ideas: aiAnalysis?.storyIdeas || [
            { title: 'Follow the money trail', description: 'Track where fraud funds went', searches: ['asset forfeiture', 'restitution'] }
        ],
        lastUpdated: timestamp
    };
    saveData('story-ideas.json', storyIdeas);
    
    // 6. Update search-terms.json (for future monitoring)
    let searchTerms = loadCurrentData('search-terms.json') || { terms: SEARCH_TERMS };
    if (aiAnalysis?.newSearchTerms) {
        const newTerms = aiAnalysis.newSearchTerms.filter(t => !searchTerms.terms.includes(t));
        searchTerms.terms.push(...newTerms);
        if (newTerms.length) console.log(`🆕 Added new search terms: ${newTerms.join(', ')}`);
    }
    searchTerms.lastUpdated = timestamp;
    saveData('search-terms.json', searchTerms);
    
    // 7. Update stats.json with AI briefing
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
            list: investigations.cases?.map(c => c.name) || []
        },
        briefing: aiAnalysis?.briefing || "Good morning. The AI is currently analyzing the latest developments in Minnesota's fraud investigations. Check back soon for today's briefing."
    };
    saveData('stats.json', statsData);
    
    console.log('✅ All data files updated!');
}

// ============================================
// MAIN
// ============================================
async function main() {
    console.log('========================================');
    console.log('🌟 NORTH STAR WATCHDOG V4 - AI UPDATER');
    console.log('========================================');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log('');
    
    if (!GROQ_API_KEY) {
        console.error('❌ ERROR: GROQ_API_KEY not set!');
        console.log('Add your FREE Groq API key to GitHub Secrets:');
        console.log('  Settings → Secrets → Actions → New secret');
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
        console.log('⚠️ No articles found, keeping existing data');
        process.exit(0);
    }
    
    // Step 2: AI analysis
    const aiAnalysis = await analyzeWithAI(articles);
    
    if (aiAnalysis) {
        console.log('🤖 AI Analysis complete:');
        console.log(`  - Breaking: ${aiAnalysis.breaking?.title || 'None'}`);
        console.log(`  - Trending topics: ${aiAnalysis.trending?.length || 0}`);
        console.log(`  - Investigation updates: ${aiAnalysis.investigationUpdates?.length || 0}`);
        console.log(`  - Figure updates: ${aiAnalysis.figureUpdates?.length || 0}`);
        console.log(`  - New search terms: ${aiAnalysis.newSearchTerms?.length || 0}`);
    } else {
        console.log('⚠️ AI analysis failed, using basic update');
    }
    
    // Step 3: Update all data files
    await updateAllData(articles, aiAnalysis);
    
    console.log('');
    console.log('========================================');
    console.log('✅ UPDATE COMPLETE');
    console.log('========================================');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
