/**
 * NORTH STAR WATCHDOG - X/TWITTER INTEGRATION
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MODULE: Social Media Intelligence & Broadcasting
 * ═══════════════════════════════════════════════════════════════
 * 
 * I monitor X for breaking news and post my findings.
 * Users can @ me to request entity scans.
 * 
 * CAPABILITIES:
 * - Post red flags and findings automatically
 * - Monitor hashtags and keywords for breaking news
 * - Respond to @ mentions with entity scans
 * - Daily briefing posts
 * 
 * REQUIRES:
 * - X_API_KEY
 * - X_API_SECRET
 * - X_ACCESS_TOKEN
 * - X_ACCESS_SECRET
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================
// OAUTH 1.0a AUTHENTICATION
// ============================================

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
    const sortedParams = Object.keys(params).sort().map(key => 
        `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    ).join('&');
    
    const signatureBase = [
        method.toUpperCase(),
        encodeURIComponent(url),
        encodeURIComponent(sortedParams)
    ].join('&');
    
    const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret || '')}`;
    
    return crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
}

function generateOAuthHeader(method, url, extraParams = {}) {
    const apiKey = process.env.X_API_KEY;
    const apiSecret = process.env.X_API_SECRET;
    const accessToken = process.env.X_ACCESS_TOKEN;
    const accessSecret = process.env.X_ACCESS_SECRET;
    
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('X API credentials not set');
    }
    
    const oauthParams = {
        oauth_consumer_key: apiKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: accessToken,
        oauth_version: '1.0'
    };
    
    const allParams = { ...oauthParams, ...extraParams };
    const signature = generateOAuthSignature(method, url, allParams, apiSecret, accessSecret);
    oauthParams.oauth_signature = signature;
    
    const headerParts = Object.keys(oauthParams).sort().map(key =>
        `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`
    );
    
    return `OAuth ${headerParts.join(', ')}`;
}

// ============================================
// API REQUESTS
// ============================================

function makeRequest(method, url, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const authHeader = generateOAuthHeader(method, url);
        
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json',
                'User-Agent': 'NorthStarWatchdog-Polaris/1.0'
            },
            timeout: 30000
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ success: true, data: json, status: res.statusCode });
                    } else {
                        resolve({ success: false, error: json, status: res.statusCode });
                    }
                } catch (e) {
                    resolve({ success: false, error: data, status: res.statusCode });
                }
            });
        });
        
        req.on('error', (e) => resolve({ success: false, error: e.message }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
        
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

// ============================================
// POSTING TWEETS
// ============================================

/**
 * Post a tweet
 */
async function postTweet(text) {
    console.log(`  🐦 Posting tweet: ${text.substring(0, 50)}...`);
    
    const url = 'https://api.twitter.com/2/tweets';
    const result = await makeRequest('POST', url, { text });
    
    if (result.success) {
        console.log(`    ✓ Tweet posted: ${result.data.data?.id}`);
        return { success: true, tweetId: result.data.data?.id };
    } else {
        console.log(`    ❌ Tweet failed: ${JSON.stringify(result.error)}`);
        return { success: false, error: result.error };
    }
}

/**
 * Post a thread (multiple tweets)
 */
async function postThread(tweets) {
    console.log(`  🐦 Posting thread: ${tweets.length} tweets`);
    
    const postedIds = [];
    let replyToId = null;
    
    for (const text of tweets) {
        const url = 'https://api.twitter.com/2/tweets';
        const body = { text };
        
        if (replyToId) {
            body.reply = { in_reply_to_tweet_id: replyToId };
        }
        
        const result = await makeRequest('POST', url, body);
        
        if (result.success) {
            replyToId = result.data.data?.id;
            postedIds.push(replyToId);
            console.log(`    ✓ Tweet ${postedIds.length}/${tweets.length} posted`);
        } else {
            console.log(`    ❌ Thread failed at tweet ${postedIds.length + 1}`);
            break;
        }
        
        // Rate limit protection
        await new Promise(r => setTimeout(r, 1000));
    }
    
    return { success: postedIds.length === tweets.length, tweetIds: postedIds };
}

/**
 * Reply to a tweet
 */
async function replyToTweet(tweetId, text) {
    console.log(`  🐦 Replying to ${tweetId}`);
    
    const url = 'https://api.twitter.com/2/tweets';
    const body = {
        text,
        reply: { in_reply_to_tweet_id: tweetId }
    };
    
    const result = await makeRequest('POST', url, body);
    
    if (result.success) {
        console.log(`    ✓ Reply posted`);
        return { success: true, tweetId: result.data.data?.id };
    } else {
        console.log(`    ❌ Reply failed`);
        return { success: false, error: result.error };
    }
}

// ============================================
// READING TWEETS & MENTIONS
// ============================================

/**
 * Get recent mentions of @NorthStarAgent
 */
async function getMentions(sinceId = null) {
    // First get our user ID
    const meUrl = 'https://api.twitter.com/2/users/me';
    const meResult = await makeRequest('GET', meUrl);
    
    if (!meResult.success) {
        console.log('    ❌ Could not get user ID');
        return { success: false, mentions: [] };
    }
    
    const userId = meResult.data.data?.id;
    let mentionsUrl = `https://api.twitter.com/2/users/${userId}/mentions?tweet.fields=author_id,created_at,text&max_results=10`;
    
    if (sinceId) {
        mentionsUrl += `&since_id=${sinceId}`;
    }
    
    const result = await makeRequest('GET', mentionsUrl);
    
    if (result.success && result.data.data) {
        return { success: true, mentions: result.data.data };
    }
    
    return { success: true, mentions: [] };
}

/**
 * Search for recent tweets matching keywords
 */
async function searchTweets(query, maxResults = 10) {
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&tweet.fields=author_id,created_at,text,public_metrics&max_results=${maxResults}`;
    
    const result = await makeRequest('GET', url);
    
    if (result.success && result.data.data) {
        return { success: true, tweets: result.data.data };
    }
    
    return { success: true, tweets: [] };
}

// ============================================
// HIGH-LEVEL FUNCTIONS
// ============================================

/**
 * Post a red flag finding
 */
async function postRedFlag(redFlag) {
    const emoji = getTypeEmoji(redFlag.type);
    const confidence = redFlag.confidence || 0;
    const entities = (redFlag.entities || []).slice(0, 2).join(', ');
    
    let tweet = `${emoji} INTEL ALERT\n\n`;
    tweet += `${redFlag.description?.substring(0, 180) || 'New pattern detected'}\n\n`;
    tweet += `📊 Confidence: ${confidence}%\n`;
    if (entities) tweet += `🏷️ ${entities}\n`;
    tweet += `\n🔗 ghost081280.github.io/north-star-watchdog`;
    
    // Ensure under 280 chars
    if (tweet.length > 280) {
        tweet = tweet.substring(0, 277) + '...';
    }
    
    return await postTweet(tweet);
}

/**
 * Post daily briefing
 */
async function postBriefing(stats, briefing) {
    const tweets = [];
    
    // Tweet 1: Stats
    tweets.push(`📊 DAILY BRIEFING - Minnesota Fraud Tracker

💰 Alleged: ${stats.alleged || '$9B+'}
⚖️ Charged: ${stats.charged || '70+'}
✅ Convicted: ${stats.convicted || '28+'}
📁 Active Cases: ${stats.activeCases || '5'}

Thread 🧵👇`);
    
    // Tweet 2: Briefing summary (truncated)
    if (briefing && briefing.length > 50) {
        let briefingText = briefing.substring(0, 250);
        if (briefing.length > 250) briefingText += '...';
        tweets.push(`🕵️ Agent Polaris Reports:\n\n${briefingText}`);
    }
    
    // Tweet 3: CTA
    tweets.push(`🔍 Want me to scan an entity?\n\n@ me with any name, organization, or daycare and I'll check:\n• ProPublica Nonprofits\n• FEC Campaign Finance\n• OIG Healthcare Exclusions\n• OpenCorporates\n• USASpending\n\n🔗 ghost081280.github.io/north-star-watchdog`);
    
    return await postThread(tweets);
}

/**
 * Post scan results in reply to a mention
 */
async function postScanResults(tweetId, entityName, results) {
    let reply = `🔍 Scan results for "${entityName}":\n\n`;
    
    if (results.found && results.found > 0) {
        if (results.nonprofits) reply += `📋 ProPublica: ${results.nonprofits} records\n`;
        if (results.fec) reply += `💰 FEC: ${results.fec} contributions\n`;
        if (results.oig) reply += `🏥 OIG: ${results.oig} exclusions\n`;
        if (results.companies) reply += `🏢 Corps: ${results.companies} companies\n`;
        if (results.spending) reply += `💵 USASpending: ${results.spending} awards\n`;
        reply += `\n🔗 Full details at ghost081280.github.io/north-star-watchdog`;
    } else {
        reply += `No records found in public databases.\n\nThis doesn't mean they're clean - just not in our current data sources.`;
    }
    
    // Truncate if needed
    if (reply.length > 280) {
        reply = reply.substring(0, 277) + '...';
    }
    
    return await replyToTweet(tweetId, reply);
}

/**
 * Scan X for breaking news
 */
async function scanForBreakingNews() {
    console.log('  🐦 Scanning X for breaking news...');
    
    const queries = [
        'Minnesota fraud',
        'Minnesota daycare fraud',
        'Feeding Our Future',
        'Minnesota DCYF',
        'Minnesota welfare fraud'
    ];
    
    const allTweets = [];
    
    for (const query of queries) {
        const result = await searchTweets(query, 5);
        if (result.success && result.tweets) {
            allTweets.push(...result.tweets.map(t => ({
                ...t,
                query
            })));
        }
        await new Promise(r => setTimeout(r, 1000)); // Rate limit
    }
    
    // Sort by engagement
    allTweets.sort((a, b) => {
        const aMetrics = a.public_metrics || {};
        const bMetrics = b.public_metrics || {};
        const aScore = (aMetrics.retweet_count || 0) + (aMetrics.like_count || 0);
        const bScore = (bMetrics.retweet_count || 0) + (bMetrics.like_count || 0);
        return bScore - aScore;
    });
    
    console.log(`    Found ${allTweets.length} tweets`);
    
    return {
        success: true,
        tweets: allTweets.slice(0, 20),
        scannedAt: new Date().toISOString()
    };
}

/**
 * Process mentions and respond to scan requests
 */
async function processMentions(osintEnrichFn) {
    console.log('  🐦 Checking mentions...');
    
    // Load last processed mention ID
    const learningPath = path.join(__dirname, '..', 'data', 'learning.json');
    let lastMentionId = null;
    
    try {
        const learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
        lastMentionId = learning.lastMentionId;
    } catch (e) {}
    
    const mentionsResult = await getMentions(lastMentionId);
    
    if (!mentionsResult.success || !mentionsResult.mentions.length) {
        console.log('    No new mentions');
        return { processed: 0 };
    }
    
    console.log(`    Found ${mentionsResult.mentions.length} new mentions`);
    
    let processed = 0;
    
    for (const mention of mentionsResult.mentions) {
        // Extract entity name from mention
        const text = mention.text.replace(/@\w+/g, '').trim();
        
        // Skip if too short or just greeting
        if (text.length < 3 || /^(hi|hello|hey|thanks)/i.test(text)) {
            continue;
        }
        
        console.log(`    Processing: "${text}"`);
        
        // Run OSINT scan if function provided
        if (osintEnrichFn) {
            try {
                const scanResults = await osintEnrichFn({ entities: [text] });
                await postScanResults(mention.id, text, {
                    found: scanResults.sourcesUsed?.length || 0,
                    nonprofits: scanResults.nonprofits?.length || 0,
                    fec: scanResults.campaigns?.length || 0,
                    oig: scanResults.exclusions?.length || 0,
                    companies: scanResults.companies?.length || 0,
                    spending: scanResults.spending?.length || 0
                });
                processed++;
            } catch (e) {
                console.log(`    ❌ Scan failed: ${e.message}`);
            }
        }
        
        // Update last mention ID
        try {
            const learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
            learning.lastMentionId = mention.id;
            fs.writeFileSync(learningPath, JSON.stringify(learning, null, 2));
        } catch (e) {}
        
        // Rate limit
        await new Promise(r => setTimeout(r, 2000));
    }
    
    return { processed };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTypeEmoji(type) {
    const emojis = {
        'federal_freeze': '🧊',
        'federal_charges': '⚖️',
        'program_termination': '🚫',
        'shell_company': '🏢',
        'closed_facility': '🔒',
        'nonprofit_red_flag': '🚩',
        'congressional_oversight': '🏛️',
        'payment_irregularity': '💰',
        'community_backlash': '👥'
    };
    return emojis[type] || '🚨';
}

/**
 * Check if X credentials are configured
 */
function isConfigured() {
    return !!(
        process.env.X_API_KEY &&
        process.env.X_API_SECRET &&
        process.env.X_ACCESS_TOKEN &&
        process.env.X_ACCESS_SECRET
    );
}

/**
 * Test X connection
 */
async function testConnection() {
    if (!isConfigured()) {
        return { success: false, error: 'X credentials not configured' };
    }
    
    const url = 'https://api.twitter.com/2/users/me';
    const result = await makeRequest('GET', url);
    
    if (result.success) {
        return { 
            success: true, 
            username: result.data.data?.username,
            message: `Connected as @${result.data.data?.username}`
        };
    }
    
    return { success: false, error: result.error };
}

module.exports = {
    // Core functions
    postTweet,
    postThread,
    replyToTweet,
    getMentions,
    searchTweets,
    
    // High-level functions
    postRedFlag,
    postBriefing,
    postScanResults,
    scanForBreakingNews,
    processMentions,
    
    // Utility
    isConfigured,
    testConnection
};
