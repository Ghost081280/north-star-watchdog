/**
 * NORTH STAR WATCHDOG - AI SCRAPER
 * Handles all news scraping and RSS feed processing
 */

const https = require('https');
const fs = require('fs');

// Base search terms (AI expands this list dynamically)
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

/**
 * Fetch Google News RSS for a search term
 */
async function fetchGoogleNews(searchTerm) {
    return new Promise((resolve) => {
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
                            date: pubDate ? new Date(pubDate).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                            }) : 'Recent',
                            timestamp: pubDate ? new Date(pubDate).getTime() : Date.now(),
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

/**
 * Load dynamic search terms from file
 */
function loadSearchTerms() {
    try {
        const data = JSON.parse(fs.readFileSync('data/search-terms.json', 'utf8'));
        return data.terms || BASE_SEARCH_TERMS;
    } catch {
        return BASE_SEARCH_TERMS;
    }
}

/**
 * Scrape all news sources
 */
async function scrapeAllNews() {
    console.log('  Scraping Google News RSS...');
    
    const searchTerms = loadSearchTerms().slice(0, 20); // Limit to prevent rate limiting
    const allArticles = [];
    
    for (const term of searchTerms) {
        const articles = await fetchGoogleNews(term);
        allArticles.push(...articles);
        
        if (articles.length > 0) {
            console.log(`    - "${term}": ${articles.length} articles`);
        }
        
        // Small delay to be nice to Google
        await new Promise(r => setTimeout(r, 200));
    }
    
    // Deduplicate by title similarity
    const seen = new Set();
    const unique = allArticles.filter(a => {
        const key = a.title.toLowerCase().substring(0, 50);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    
    // Sort by timestamp (newest first)
    unique.sort((a, b) => b.timestamp - a.timestamp);
    
    console.log(`  Total unique articles: ${unique.length}`);
    return unique;
}

/**
 * Scrape specific domain for news (for local MN sources)
 */
async function scrapeDomainNews(domain, searchQuery) {
    // This could be expanded to scrape specific sites like Star Tribune, MPR, etc.
    // For now, we use Google News which indexes them
    return fetchGoogleNews(`site:${domain} ${searchQuery}`);
}

module.exports = {
    scrapeAllNews,
    fetchGoogleNews,
    scrapeDomainNews,
    loadSearchTerms,
    BASE_SEARCH_TERMS
};
