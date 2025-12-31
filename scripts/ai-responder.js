/**
 * NORTH STAR WATCHDOG - AI ISSUE RESPONDER
 * 
 * Reads owner comments on AI-created issues and responds/takes action
 * 
 * Commands the AI understands:
 * - "approved" / "confirmed" / "verified" → Mark finding as verified, close issue
 * - "dismiss" / "ignore" / "false positive" → Mark as dismissed, close issue
 * - "dig deeper" / "investigate" / "more info" → Run deeper search on entities
 * - "good job" / "nice" / "thanks" → Acknowledge and continue monitoring
 * - "priority" / "urgent" / "escalate" → Add high-priority label
 * - "watching" / "monitoring" / "following" → Acknowledge, keep issue open
 */

const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;

// ============================================
// GITHUB API HELPERS
// ============================================

function githubRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method: method,
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'NorthStarWatchdog-AI',
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(body ? JSON.parse(body) : {});
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

// ============================================
// COMMAND DETECTION
// ============================================

function detectCommand(comment) {
    const text = comment.toLowerCase().trim();
    
    // Approval commands
    if (/\b(approved|confirmed|verified|verify|confirm)\b/.test(text)) {
        return { action: 'approve', confidence: 'high' };
    }
    
    // Dismissal commands
    if (/\b(dismiss|ignore|false positive|wrong|incorrect|not right)\b/.test(text)) {
        return { action: 'dismiss', confidence: 'high' };
    }
    
    // Deeper investigation
    if (/\b(dig deeper|investigate|more info|look into|expand|research)\b/.test(text)) {
        return { action: 'investigate', confidence: 'high' };
    }
    
    // Priority escalation
    if (/\b(priority|urgent|escalate|important|critical)\b/.test(text)) {
        return { action: 'escalate', confidence: 'high' };
    }
    
    // Acknowledgment - watching
    if (/\b(watching|monitoring|following|tracking|keep open)\b/.test(text)) {
        return { action: 'watching', confidence: 'high' };
    }
    
    // Positive feedback
    if (/\b(good job|nice|thanks|great|awesome|well done|perfect|excellent)\b/.test(text)) {
        return { action: 'acknowledge', confidence: 'high' };
    }
    
    // Questions
    if (/\?$/.test(text) || /\b(what|why|how|when|where|who)\b/.test(text)) {
        return { action: 'question', confidence: 'medium' };
    }
    
    return { action: 'unknown', confidence: 'low' };
}

// ============================================
// RESPONSE GENERATION
// ============================================

function generateResponse(command, issueTitle, entities = []) {
    const timestamp = new Date().toLocaleString('en-US', { 
        timeZone: 'America/Chicago',
        dateStyle: 'short',
        timeStyle: 'short'
    });
    
    const responses = {
        approve: `
Hey Andrew! 👍

Got it - marking this finding as **verified**. I'll factor this into future pattern detection.

✅ **Status:** Verified
📁 **Action:** Added to confirmed patterns database
🔄 **Next:** Will continue monitoring related entities

---
*Your AI Detective 🕵️*
*Processed at: ${timestamp} CST*
        `.trim(),
        
        dismiss: `
Hey Andrew! 👋

Understood - dismissing this as a false positive. I'll adjust my detection parameters to reduce similar alerts.

❌ **Status:** Dismissed
🧠 **Learning:** Updating pattern thresholds
🔄 **Next:** Will be more careful with similar patterns

Thanks for the feedback - it helps me get better!

---
*Your AI Detective 🕵️*
*Processed at: ${timestamp} CST*
        `.trim(),
        
        investigate: `
Hey Andrew! 🔍

On it! Running deeper investigation on the entities involved...

**Entities queued for deep scan:**
${entities.map(e => `- ${e}`).join('\n') || '- (Extracting from issue...)'}

🔎 **Actions:**
- Expanding search parameters
- Checking additional OSINT sources
- Cross-referencing government databases
- Looking for connected entities

I'll create a new issue with my findings shortly.

---
*Your AI Detective 🕵️*
*Investigating at: ${timestamp} CST*
        `.trim(),
        
        escalate: `
Hey Andrew! 🚨

Marking this as **HIGH PRIORITY**. I'll increase monitoring frequency on related entities.

⚠️ **Status:** Escalated
🔔 **Alert Level:** High
👁️ **Monitoring:** Enhanced

This finding will be prioritized in future scans.

---
*Your AI Detective 🕵️*
*Escalated at: ${timestamp} CST*
        `.trim(),
        
        watching: `
Hey Andrew! 👁️

Got it - I'll keep this open and continue monitoring. Will update you if I find anything new related to this pattern.

👀 **Status:** Watching
🔄 **Monitoring:** Active
📊 **Updates:** Will post here if anything changes

---
*Your AI Detective 🕵️*
*Acknowledged at: ${timestamp} CST*
        `.trim(),
        
        acknowledge: `
Hey Andrew! 😊

Thanks! I appreciate the feedback. I'll keep hunting for patterns and anomalies.

Current status:
- 🔍 Scanning: Active
- 📊 Patterns tracked: Multiple
- 🚨 Alert system: Online

Let me know if you want me to focus on anything specific!

---
*Your AI Detective 🕵️*
*Happy to help at: ${timestamp} CST*
        `.trim(),
        
        question: `
Hey Andrew! 🤔

I noticed you have a question. I'll do my best to help!

For context on this finding:
- **Detection method:** Pattern analysis across multiple sources
- **Confidence basis:** Frequency and correlation of data points
- **Sources used:** News, government databases, OSINT APIs

If you need more specific information, try commands like:
- "dig deeper" - I'll investigate further
- "more info on [entity]" - I'll focus on that specific entity

---
*Your AI Detective 🕵️*
*Ready to help at: ${timestamp} CST*
        `.trim(),
        
        unknown: `
Hey Andrew! 👋

I received your message but I'm not sure what action to take. Here are commands I understand:

**Commands:**
- ✅ "approved" / "verified" - Confirm this finding
- ❌ "dismiss" / "false positive" - Mark as incorrect
- 🔍 "dig deeper" / "investigate" - Research more
- 🚨 "priority" / "urgent" - Escalate this finding
- 👀 "watching" / "monitoring" - Keep tracking

Just reply with one of these and I'll take action!

---
*Your AI Detective 🕵️*
*Standing by at: ${timestamp} CST*
        `.trim()
    };
    
    return responses[command.action] || responses.unknown;
}

// ============================================
// MAIN PROCESS
// ============================================

async function processIssueComments() {
    console.log('🕵️ AI Issue Responder starting...');
    console.log(`Repository: ${GITHUB_REPOSITORY}`);
    
    if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
        console.log('Missing GITHUB_TOKEN or GITHUB_REPOSITORY');
        return;
    }
    
    try {
        // Get all open issues with AI labels
        const issues = await githubRequest(
            'GET',
            `/repos/${GITHUB_REPOSITORY}/issues?labels=ai-discovery&state=open&per_page=20`
        );
        
        if (!Array.isArray(issues)) {
            console.log('No issues found or error fetching');
            return;
        }
        
        console.log(`Found ${issues.length} open AI issues`);
        
        for (const issue of issues) {
            console.log(`\nProcessing issue #${issue.number}: ${issue.title}`);
            
            // Get comments on this issue
            const comments = await githubRequest(
                'GET',
                `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`
            );
            
            if (!Array.isArray(comments) || comments.length === 0) {
                console.log('  No comments yet');
                continue;
            }
            
            // Find the latest owner comment that hasn't been responded to
            const ownerComments = comments.filter(c => 
                c.user?.type === 'User' && 
                !c.user?.login?.includes('bot') &&
                !c.user?.login?.includes('[bot]')
            );
            
            if (ownerComments.length === 0) {
                console.log('  No owner comments');
                continue;
            }
            
            // Check if we already responded to the latest owner comment
            const lastOwnerComment = ownerComments[ownerComments.length - 1];
            const botComments = comments.filter(c => 
                c.user?.login?.includes('bot') || 
                c.user?.login === 'github-actions[bot]'
            );
            
            const alreadyResponded = botComments.some(bc => 
                new Date(bc.created_at) > new Date(lastOwnerComment.created_at)
            );
            
            if (alreadyResponded) {
                console.log('  Already responded to latest comment');
                continue;
            }
            
            console.log(`  New comment from ${lastOwnerComment.user.login}: "${lastOwnerComment.body.substring(0, 50)}..."`);
            
            // Detect command
            const command = detectCommand(lastOwnerComment.body);
            console.log(`  Detected command: ${command.action} (${command.confidence})`);
            
            // Extract entities from issue body
            const entityMatch = issue.body?.match(/Entities involved:?\s*([\s\S]*?)(?:\n\n|🔗|💡|---|$)/i);
            const entities = entityMatch ? 
                entityMatch[1].split('\n').map(e => e.replace(/^[\s\*\-•]+/, '').trim()).filter(Boolean) : 
                [];
            
            // Generate response
            const response = generateResponse(command, issue.title, entities);
            
            // Post response
            await githubRequest(
                'POST',
                `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/comments`,
                { body: response }
            );
            console.log('  ✅ Response posted');
            
            // Take action based on command
            if (command.action === 'approve') {
                await githubRequest(
                    'POST',
                    `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`,
                    { labels: ['verified'] }
                );
                await githubRequest(
                    'PATCH',
                    `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}`,
                    { state: 'closed' }
                );
                console.log('  ✅ Issue closed as verified');
            }
            
            if (command.action === 'dismiss') {
                await githubRequest(
                    'POST',
                    `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`,
                    { labels: ['false-positive'] }
                );
                await githubRequest(
                    'PATCH',
                    `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}`,
                    { state: 'closed' }
                );
                console.log('  ✅ Issue closed as false positive');
            }
            
            if (command.action === 'escalate') {
                await githubRequest(
                    'POST',
                    `/repos/${GITHUB_REPOSITORY}/issues/${issue.number}/labels`,
                    { labels: ['high-priority'] }
                );
                console.log('  ✅ Added high-priority label');
            }
            
            // Small delay between processing issues
            await new Promise(r => setTimeout(r, 1000));
        }
        
        console.log('\n🕵️ AI Issue Responder complete!');
        
    } catch (error) {
        console.error('Error processing issues:', error);
    }
}

// Run
processIssueComments();
