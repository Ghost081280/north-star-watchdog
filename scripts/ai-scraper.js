/**
 * NORTH STAR WATCHDOG - NEWS SCRAPER
 * 
 * Scrapes Google News RSS feed for Minnesota fraud stories.
 * This is FREE and requires no API key.
 * 
 * SELF-LEARNING: Reads search queries from data/learning.json
 * so the AI can add new terms as it discovers them.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Default search queries (fallback if learning.json doesn't exist)
const DEFAULT_QUERIES = [
    'Minnesota nonprofit fraud',
    'Minnesota charity fraud',
    'Minnesota embezzlement charges',
    'Feeding Our Future fraud',
    'Minnesota government fraud',
    'Minnesota financial crime indictment',
    'Minnesota fraud conviction',
    'Minnesota theft charges nonprofit'
];

/**
 * Load search queries from learning.json or use defaults
 */
function loadSearchQueries() {
    const learningPath = path.join(__dirname, '..', 'data', 'learning.json');
    try {
        if (fs.existsSync(learningPath)) {
            const learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
            if (learning.searchQueries && learning.searchQueries.length > 0) {
                console.log(`  ✓ Loaded ${learning.searchQueries.length} search queries from learning.json`);
                return learning.searchQueries;
            }
        }
    } catch (e) {
        console.log(`  ⚠ Could not load learning.json: ${e.message}`);
    }
    console.log(`  ✓ Using ${DEFAULT_QUERIES.length} default search queries`);
    return DEFAULT_QUERIES;
}

/**
 * Fetch URL with timeout
 */
function fetchUrl(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
}

/**
 * Parse RSS XML into articles
 */
function parseRSS(xml) {
    const articles = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    
    while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];
        
        const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i)?.[1] || '';
        const link = item.match(/<link>(.*?)<\/link>/i)?.[1] || '';
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/i)?.[1] || '';
        const description = item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/i)?.[1] || '';
        const source = item.match(/<source.*?>(.*?)<\/source>/i)?.[1] || 'Google News';
        
        if (title && link) {
            articles.push({
                title: cleanText(title),
                link: link.trim(),
                pubDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                description: cleanText(description),
                source: cleanText(source)
            });
        }
    }
    
    return articles;
}

/**
 * Clean HTML entities and tags from text
 */
function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .trim();
}

/**
 * Scrape Google News RSS for all search queries
 */
async function scrapeGoogleNews() {
    console.log('  Scraping Google News RSS feeds...');
    
    // Load queries from learning.json (self-learning feature)
    const searchQueries = loadSearchQueries();
    
    const allArticles = [];
    const seenUrls = new Set();
    
    for (const query of searchQueries) {
        try {
            const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
            console.log(`    Searching: "${query}"`);
            
            const response = await fetchUrl(url);
            
            if (response.status === 200) {
                const articles = parseRSS(response.data);
                
                for (const article of articles) {
                    // Dedupe by URL
                    if (!seenUrls.has(article.link)) {
                        seenUrls.add(article.link);
                        article.query = query;
                        allArticles.push(article);
                    }
                }
                
                console.log(`      Found ${articles.length} articles`);
            }
            
            // Rate limit
            await new Promise(r => setTimeout(r, 500));
            
        } catch (error) {
            console.log(`      Error: ${error.message}`);
        }
    }
    
    // Sort by date, newest first
    allArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    
    // Determine breaking news (most recent relevant article)
    const breaking = allArticles[0] || null;
    
    console.log(`  Total unique articles: ${allArticles.length}`);
    
    return {
        articles: allArticles.slice(0, 50), // Keep top 50
        breaking,
        lastUpdated: new Date().toISOString(),
        queriesUsed: searchQueries
    };
}

module.exports = { scrapeGoogleNews };
