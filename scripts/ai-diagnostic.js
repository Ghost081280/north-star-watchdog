/**
 * NORTH STAR WATCHDOG - SELF-DIAGNOSTIC MODULE
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MODULE: Self-Awareness & Health Monitoring
 * ═══════════════════════════════════════════════════════════════
 * 
 * I monitor my own health and detect issues.
 * Repairs are handled by ai-repair.js
 * 
 * CAPABILITIES:
 * - Test GROQ API and detect model deprecation
 * - Test all OSINT APIs
 * - Verify data file integrity
 * - Detect common issues
 * - Report unfixable issues via GitHub Issues
 * - Update README with health status
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Import repair module
const { repairIssue, repairAll } = require('./ai-repair');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCRIPTS_DIR = __dirname;

// Known working GROQ models (in order of preference)
// Updated: Jan 2026 - removed decommissioned models
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
];

// Expected data files
const REQUIRED_DATA_FILES = [
    'news.json',
    'figures.json', 
    'investigations.json',
    'stats.json',
    'red-flags.json',
    'learning.json',
    'trending.json',
    'story-ideas.json'
];

// Validation rules
const BLOCKED_JOURNALISTS = ['nick shirley', 'rich mchugh', 'mario nawfal'];
const VALID_STATUSES = ['charged', 'convicted', 'sentenced', 'indicted'];

// ============================================
// GROQ API TESTING
// ============================================

async function testGroqModel(apiKey, model) {
    return new Promise((resolve) => {
        const body = JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Say "OK" if you are working.' }],
            max_tokens: 10
        });
        
        const req = https.request({
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            },
            timeout: 15000
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        const errorMsg = json.error.message || '';
                        const isRateLimit = errorMsg.includes('Rate limit') || 
                                           errorMsg.includes('rate_limit') || 
                                           res.statusCode === 429;
                        resolve({ 
                            success: false, 
                            error: errorMsg, 
                            model,
                            rateLimited: isRateLimit
                        });
                    } else {
                        resolve({ success: true, model, rateLimited: false });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'Parse error', model, rateLimited: false });
                }
            });
        });
        
        req.on('error', (e) => resolve({ success: false, error: e.message, model, rateLimited: false }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout', model, rateLimited: false }); });
        req.write(body);
        req.end();
    });
}

async function testGroqApi() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return { success: false, error: 'GROQ_API_KEY not set', fixable: false };
    }
    
    let rateLimitedModels = [];
    
    for (const model of GROQ_MODELS) {
        const result = await testGroqModel(apiKey, model);
        if (result.success) {
            return { success: true, model, message: `Model ${model} is working` };
        }
        
        if (result.rateLimited) {
            rateLimitedModels.push(model);
            console.log(`  ⚠️ ${model} rate limited, trying next...`);
            continue; // Try next model
        }
    }
    
    if (rateLimitedModels.length === GROQ_MODELS.length) {
        return { 
            success: false, 
            error: 'All GROQ models are rate limited. Try again later.', 
            fixable: false,
            rateLimited: true
        };
    }
    
    return { success: false, error: 'All GROQ models failed', fixable: false };
}

function fixGroqModel(workingModel) {
    const analyzerPath = path.join(SCRIPTS_DIR, 'ai-analyzer.js');
    
    try {
        let content = fs.readFileSync(analyzerPath, 'utf8');
        const modelRegex = /model:\s*['"]([^'"]+)['"]/g;
        
        if (content.match(modelRegex)) {
            content = content.replace(modelRegex, `model: '${workingModel}'`);
            fs.writeFileSync(analyzerPath, content);
            return { success: true, message: `Updated model to ${workingModel}`, fixed: true };
        }
        
        return { success: false, error: 'Could not find model string' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ============================================
// OSINT API TESTING
// ============================================

async function quickHttpTest(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : require('http');
        const req = client.get(url, { timeout: 10000 }, (res) => {
            resolve({ success: res.statusCode >= 200 && res.statusCode < 400 });
        });
        req.on('error', () => resolve({ success: false }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
    });
}

async function testOsintApis() {
    const results = {};
    
    const tests = [
        { name: 'ProPublica Nonprofits', url: 'https://projects.propublica.org/nonprofits/api/v2/search.json?q=test' },
        { name: 'FEC', url: 'https://api.open.fec.gov/v1/candidates/search/?q=test&api_key=DEMO_KEY' },
        { name: 'OpenCorporates', url: 'https://api.opencorporates.com/v0.4/companies/search?q=test' },
        { name: 'USASpending', url: 'https://api.usaspending.gov/api/v2/references/agency/' }
    ];
    
    for (const test of tests) {
        const result = await quickHttpTest(test.url);
        results[test.name] = result.success;
    }
    
    return results;
}

// ============================================
// DATA FILE VALIDATION
// ============================================

function readJsonSafe(filename) {
    const filepath = path.join(DATA_DIR, filename);
    try {
        if (fs.existsSync(filepath)) {
            return { exists: true, data: JSON.parse(fs.readFileSync(filepath, 'utf8')), valid: true };
        }
        return { exists: false, valid: false };
    } catch (e) {
        return { exists: true, valid: false, error: e.message };
    }
}

function verifyDataFiles() {
    const results = {};
    
    for (const file of REQUIRED_DATA_FILES) {
        results[file] = readJsonSafe(file);
    }
    
    return results;
}

// ============================================
// ISSUE DETECTION
// ============================================

function detectIssues() {
    const issues = [];
    
    // 1. Check for blanket source attribution in red flags
    const redFlags = readJsonSafe('red-flags.json');
    if (redFlags.valid && redFlags.data.flags) {
        const blanketFlags = redFlags.data.flags.filter(f => 
            f.apisUsed && f.apisUsed.length === 6
        );
        if (blanketFlags.length > 0) {
            issues.push({
                id: 'blanket-sources',
                severity: 'warning',
                component: 'red-flags.json',
                description: `${blanketFlags.length} flags have blanket source attribution (all 6 sources)`,
                fixable: true,
                fix: 'Remove flags with blanket sources'
            });
        }
    }
    
    // 2. Check for journalists in figures
    const figures = readJsonSafe('figures.json');
    if (figures.valid && figures.data.people) {
        const journalists = figures.data.people.filter(p => 
            BLOCKED_JOURNALISTS.some(j => (p.name || '').toLowerCase().includes(j))
        );
        if (journalists.length > 0) {
            issues.push({
                id: 'journalists-in-figures',
                severity: 'error',
                component: 'figures.json',
                description: `Found journalists in Key Figures: ${journalists.map(j => j.name).join(', ')}`,
                fixable: true,
                fix: 'Remove journalists from figures list'
            });
        }
        
        // 3. Check for figures without allegations
        const noAllegations = figures.data.people.filter(p => 
            !p.allegations || p.allegations.length === 0
        );
        if (noAllegations.length > 0) {
            issues.push({
                id: 'figures-no-allegations',
                severity: 'warning',
                component: 'figures.json',
                description: `${noAllegations.length} figures have no allegations`,
                fixable: true,
                fix: 'Remove figures without allegations'
            });
        }
        
        // 4. Check for invalid statuses
        const invalidStatus = figures.data.people.filter(p => 
            p.status && !VALID_STATUSES.includes(p.status.toLowerCase())
        );
        if (invalidStatus.length > 0) {
            issues.push({
                id: 'invalid-status',
                severity: 'warning',
                component: 'figures.json',
                description: `${invalidStatus.length} figures have invalid status`,
                fixable: true,
                fix: 'Remove figures with invalid status'
            });
        }
    }
    
    // 5. Check for investigations without source URLs
    const investigations = readJsonSafe('investigations.json');
    if (investigations.valid && investigations.data.cases) {
        const noSource = investigations.data.cases.filter(c => 
            !c.sourceUrl || !c.sourceUrl.startsWith('http')
        );
        if (noSource.length > 0) {
            issues.push({
                id: 'investigations-no-source',
                severity: 'warning',
                component: 'investigations.json',
                description: `${noSource.length} investigations have no valid source URL`,
                fixable: true,
                fix: 'Remove investigations without source URLs'
            });
        }
    }
    
    // 6. Check for empty trending/story-ideas
    const trending = readJsonSafe('trending.json');
    if (trending.valid && (!trending.data.topics || trending.data.topics.length === 0)) {
        issues.push({
            id: 'empty-trending',
            severity: 'info',
            component: 'trending.json',
            description: 'Trending topics is empty',
            fixable: false,
            fix: 'Wait for next AI scan to populate'
        });
    }
    
    const storyIdeas = readJsonSafe('story-ideas.json');
    if (storyIdeas.valid && (!storyIdeas.data.ideas || storyIdeas.data.ideas.length === 0)) {
        issues.push({
            id: 'empty-story-ideas',
            severity: 'info',
            component: 'story-ideas.json',
            description: 'Story ideas is empty',
            fixable: false,
            fix: 'Wait for next AI scan to populate'
        });
    }
    
    // 7. Check stats baseline
    const stats = readJsonSafe('stats.json');
    if (stats.valid) {
        if (stats.data.charged < 70) {
            issues.push({
                id: 'stats-below-baseline',
                severity: 'error',
                component: 'stats.json',
                description: `Charged count (${stats.data.charged}) below verified baseline (70)`,
                fixable: true,
                fix: 'Reset to verified baseline'
            });
        }
        if (!stats.data.alleged || !stats.data.alleged.includes('9')) {
            issues.push({
                id: 'stats-alleged-wrong',
                severity: 'error',
                component: 'stats.json',
                description: `Alleged amount wrong: ${stats.data.alleged}`,
                fixable: true,
                fix: 'Reset to $9B+ verified baseline'
            });
        }
    }
    
    // 8. Check data freshness
    for (const file of ['stats.json', 'news.json', 'red-flags.json']) {
        const data = readJsonSafe(file);
        if (data.valid && data.data.lastUpdated) {
            const age = Date.now() - new Date(data.data.lastUpdated).getTime();
            const hoursOld = age / (1000 * 60 * 60);
            if (hoursOld > 24) {
                issues.push({
                    id: `stale-${file}`,
                    severity: hoursOld > 168 ? 'error' : 'warning',
                    component: file,
                    description: `${file} is ${hoursOld.toFixed(1)} hours old`,
                    fixable: false,
                    fix: 'Check GitHub Actions workflow'
                });
            }
        }
    }
    
    // 9. Check for corrupted JSON files
    for (const file of REQUIRED_DATA_FILES) {
        const result = readJsonSafe(file);
        if (result.exists && !result.valid) {
            issues.push({
                id: `corrupted-${file}`,
                severity: 'critical',
                component: file,
                description: `${file} contains invalid JSON: ${result.error}`,
                fixable: true,
                fix: 'Reset to default structure'
            });
        }
    }
    
    // 10. Check for self-awareness initialization
    const selfAwareness = readJsonSafe('self-awareness.json');
    if (!selfAwareness.exists) {
        issues.push({
            id: 'self-awareness-missing',
            severity: 'warning',
            component: 'scripts/ai-self-awareness.js',
            description: 'Agent Polaris has not scanned its own codebase yet',
            fixable: true,
            fix: 'Run: node scripts/ai-self-awareness.js to initialize self-awareness'
        });
    } else if (selfAwareness.valid) {
        // Check if self-awareness is stale (older than 7 days)
        const timestamp = new Date(selfAwareness.data.timestamp);
        const ageHours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
        if (ageHours > 168) { // 7 days
            issues.push({
                id: 'self-awareness-stale',
                severity: 'info',
                component: 'scripts/ai-self-awareness.js',
                description: `Self-awareness report is ${Math.floor(ageHours / 24)} days old`,
                fixable: true,
                fix: 'Run: node scripts/ai-self-awareness.js to refresh self-awareness'
            });
        }
        
        // Check self-awareness health
        if (selfAwareness.data.health && selfAwareness.data.health.score < 80) {
            issues.push({
                id: 'self-awareness-unhealthy',
                severity: 'warning',
                component: 'Codebase',
                description: `Self-awareness health is ${selfAwareness.data.health.score}%: ${selfAwareness.data.health.issues?.join(', ') || 'Unknown issues'}`,
                fixable: false,
                fix: 'Review self-awareness.json for specific issues'
            });
        }
        
        // Report any limitations found
        if (selfAwareness.data.limitations && selfAwareness.data.limitations.length > 0) {
            for (const limit of selfAwareness.data.limitations) {
                issues.push({
                    id: `limitation-${limit.area.toLowerCase().replace(/\s+/g, '-')}`,
                    severity: 'info',
                    component: limit.area,
                    description: `${limit.issue}: ${limit.impact}`,
                    fixable: false,
                    fix: limit.suggestion
                });
            }
        }
    }
    
    return issues;
}

// ============================================
// GITHUB REPORTING
// ============================================

async function reportCriticalFailure(title, details) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    
    if (!token || !repo) {
        console.log('  ⚠ Cannot report to Command - GITHUB_TOKEN not set');
        return false;
    }
    
    const body = `## 🚨 POLARIS SYSTEM ALERT

**Commander,**

I've encountered an issue that requires your attention.

---

### ⚠️ Issue Details

${details}

### 🔧 Auto-Repair Status

I attempted to resolve this automatically but was unable to do so.

### 📋 Required Action

Please review and manually resolve this issue.

---

*— Agent Polaris*
*Self-Diagnostic Module*
*${new Date().toISOString()}*`;

    const [owner, repoName] = repo.split('/');
    
    const postData = JSON.stringify({
        title: `🚨 SYSTEM: ${title}`,
        body,
        labels: ['polaris-alert', 'needs-fix']
    });
    
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repoName}/issues`,
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'NorthStarWatchdog-Polaris',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => {
                if (res.statusCode === 201) {
                    console.log('  📡 POLARIS: Alert sent to Command');
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
        
        req.on('error', () => resolve(false));
        req.write(postData);
        req.end();
    });
}

async function requestNewApi(apiName, reason, sourceUrl) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    
    if (!token || !repo) return false;
    
    const body = `## 🔌 API Integration Request

**Commander,**

During my analysis, I've identified a potentially useful data source.

---

### 📡 Requested API

**Name:** ${apiName}
**Source:** ${sourceUrl || 'Discovered during analysis'}

### 💡 Reasoning

${reason}

### 🔧 Implementation Notes

If approved, I can integrate this API into my OSINT enrichment pipeline.

---

*— Agent Polaris*
*API Discovery Module*
*${new Date().toISOString()}*`;

    const [owner, repoName] = repo.split('/');
    
    const postData = JSON.stringify({
        title: `🔌 API Request: ${apiName}`,
        body,
        labels: ['api-request', 'enhancement']
    });
    
    return new Promise((resolve) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repoName}/issues`,
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'NorthStarWatchdog-Polaris',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve(res.statusCode === 201));
        });
        
        req.on('error', () => resolve(false));
        req.write(postData);
        req.end();
    });
}

// ============================================
// README AUTO-UPDATE
// ============================================

function updateReadmeHealth(healthScore, lastDiagnostic) {
    const readmePath = path.join(__dirname, '..', 'README.md');
    
    try {
        let readme = fs.readFileSync(readmePath, 'utf8');
        
        // Determine badge color
        const color = healthScore >= 80 ? 'brightgreen' : healthScore >= 60 ? 'yellow' : 'red';
        
        // Update health badge
        const healthBadgeRegex = /\[!\[System Health\]\(https:\/\/img\.shields\.io\/badge\/Health-\d+%25-\w+\)\]/g;
        const newHealthBadge = `[![System Health](https://img.shields.io/badge/Health-${healthScore}%25-${color})]`;
        
        if (readme.match(healthBadgeRegex)) {
            readme = readme.replace(healthBadgeRegex, newHealthBadge);
            fs.writeFileSync(readmePath, readme);
            console.log(`  📝 README updated: Health ${healthScore}%`);
            return true;
        }
    } catch (e) {
        console.log(`  ⚠ Could not update README: ${e.message}`);
    }
    return false;
}

// ============================================
// MAIN DIAGNOSTIC FUNCTIONS
// ============================================

async function runFullDiagnostic() {
    console.log('\n  ══════════════════════════════════════════════════════');
    console.log('  🔬 POLARIS FULL SELF-DIAGNOSTIC');
    console.log('  ══════════════════════════════════════════════════════\n');
    
    const results = {
        timestamp: new Date().toISOString(),
        tests: { passed: 0, warnings: 0, failed: 0, critical: 0 },
        issues: [],
        repairs: [],
        groq: null,
        osint: null,
        dataFiles: null,
        selfAwareness: null
    };
    
    // 0. Check Self-Awareness
    console.log('  [0/5] Checking self-awareness...');
    const selfAwareness = readJsonSafe('self-awareness.json');
    if (selfAwareness.exists && selfAwareness.valid) {
        results.selfAwareness = selfAwareness.data;
        console.log(`    ✓ Self-aware: ${selfAwareness.data.capabilities?.length || 0} capabilities, ${selfAwareness.data.health?.score || 0}% health`);
        results.tests.passed++;
    } else if (!selfAwareness.exists) {
        console.log('    ⚠ Self-awareness not initialized');
        results.tests.warnings++;
    } else {
        console.log('    ❌ Self-awareness data corrupted');
        results.tests.failed++;
    }
    
    // 1. Test GROQ API
    console.log('  [1/5] Testing GROQ API...');
    results.groq = await testGroqApi();
    if (results.groq.success) {
        console.log(`    ✓ GROQ: ${results.groq.model} working`);
        results.tests.passed++;
        
        // Check if model needs updating
        const analyzerPath = path.join(SCRIPTS_DIR, 'ai-analyzer.js');
        const content = fs.readFileSync(analyzerPath, 'utf8');
        if (!content.includes(results.groq.model)) {
            console.log(`    🔧 Updating model to ${results.groq.model}`);
            const fixResult = fixGroqModel(results.groq.model);
            if (fixResult.success) {
                results.repairs.push({ component: 'ai-analyzer.js', action: fixResult.message });
            }
        }
    } else {
        console.log(`    ❌ GROQ: ${results.groq.error}`);
        results.tests.critical++;
        results.issues.push({
            severity: 'critical',
            component: 'GROQ API',
            description: results.groq.error
        });
    }
    
    // 2. Test OSINT APIs
    console.log('\n  [2/5] Testing OSINT APIs...');
    results.osint = await testOsintApis();
    const osintWorking = Object.values(results.osint).filter(Boolean).length;
    console.log(`    ✓ OSINT: ${osintWorking}/${Object.keys(results.osint).length} APIs responding`);
    results.tests.passed += osintWorking;
    results.tests.warnings += Object.keys(results.osint).length - osintWorking;
    
    // 3. Verify data files
    console.log('\n  [3/5] Verifying data files...');
    results.dataFiles = verifyDataFiles();
    for (const [file, status] of Object.entries(results.dataFiles)) {
        if (status.valid) {
            results.tests.passed++;
        } else if (status.exists) {
            console.log(`    ❌ ${file}: Invalid JSON`);
            results.tests.failed++;
        } else {
            console.log(`    ⚠ ${file}: Missing`);
            results.tests.warnings++;
        }
    }
    
    // 4. Detect issues
    console.log('\n  [4/5] Detecting issues...');
    const issues = detectIssues();
    results.issues = [...results.issues, ...issues];
    console.log(`    Found ${issues.length} issues`);
    
    for (const issue of issues) {
        if (issue.severity === 'critical') results.tests.critical++;
        else if (issue.severity === 'error') results.tests.failed++;
        else if (issue.severity === 'warning') results.tests.warnings++;
    }
    
    // 5. Auto-repair fixable issues
    console.log('\n  [5/5] Auto-repairing fixable issues...');
    const repairResults = repairAll(issues);
    results.repairs = [...results.repairs, ...repairResults.repairs];
    
    // Adjust counts for successful repairs
    results.tests.passed += repairResults.succeeded;
    
    for (const repair of repairResults.repairs) {
        if (repair.success) {
            console.log(`    ✓ Fixed: ${repair.issue}`);
        } else {
            console.log(`    ❌ Could not fix: ${repair.issue}`);
        }
    }
    
    // Calculate health score
    const totalTests = results.tests.passed + results.tests.warnings + results.tests.failed + results.tests.critical;
    results.healthScore = totalTests > 0 
        ? Math.round((results.tests.passed / totalTests) * 100)
        : 0;
    
    // Report unfixable critical issues
    const unfixableCritical = results.issues.filter(i => 
        (i.severity === 'critical' || i.severity === 'error') && !i.fixable
    );
    
    if (unfixableCritical.length > 0) {
        const details = unfixableCritical.map(i => 
            `- **${i.component}**: ${i.description}\n  Fix: ${i.fix}`
        ).join('\n\n');
        await reportCriticalFailure('Unfixable Issues Detected', details);
    }
    
    // Update README
    updateReadmeHealth(results.healthScore, results.timestamp);
    
    // Summary
    console.log('\n  ══════════════════════════════════════════════════════');
    console.log(`  DIAGNOSTIC COMPLETE - Health: ${results.healthScore}%`);
    console.log(`  Passed: ${results.tests.passed} | Warnings: ${results.tests.warnings} | Failed: ${results.tests.failed} | Critical: ${results.tests.critical}`);
    console.log(`  Repairs made: ${results.repairs.filter(r => r.success).length}`);
    console.log('  ══════════════════════════════════════════════════════\n');
    
    return results;
}

async function preFlightCheck() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { ok: false, error: 'No API key' };
    
    const analyzerPath = path.join(SCRIPTS_DIR, 'ai-analyzer.js');
    const content = fs.readFileSync(analyzerPath, 'utf8');
    
    // Try to find model - check both formats
    // New format: GROQ_MODELS array
    // Old format: model: 'model-name'
    let currentModel = 'llama-3.3-70b-versatile'; // Default
    
    const arrayMatch = content.match(/GROQ_MODELS\s*=\s*\[\s*['"]([^'"]+)['"]/);
    const inlineMatch = content.match(/model:\s*['"]([^'"]+)['"]/);
    
    if (arrayMatch) {
        currentModel = arrayMatch[1];
    } else if (inlineMatch) {
        currentModel = inlineMatch[1];
    }
    
    console.log(`  Testing model: ${currentModel}`);
    
    const result = await testGroqModel(apiKey, currentModel);
    
    // If rate limited, try other models
    if (!result.success && result.rateLimited) {
        console.log(`  ⚠ Model ${currentModel} rate limited - trying alternatives...`);
        
        for (const model of GROQ_MODELS) {
            if (model === currentModel) continue;
            const test = await testGroqModel(apiKey, model);
            if (test.success) {
                console.log(`  🔧 Found working model: ${model}`);
                return { ok: true, fixed: false, model };
            }
            if (test.rateLimited) {
                console.log(`  ⚠️ ${model} also rate limited...`);
            }
        }
        
        return { ok: false, error: 'All models rate limited. Try again later.' };
    }
    
    // If decommissioned, try other models
    if (!result.success && result.error?.includes('decommissioned')) {
        console.log(`  ⚠ Model ${currentModel} is decommissioned - finding replacement...`);
        
        for (const model of GROQ_MODELS) {
            const test = await testGroqModel(apiKey, model);
            if (test.success) {
                console.log(`  🔧 Found working model: ${model}`);
                return { ok: true, fixed: false, model };
            }
        }
        
        return { ok: false, error: 'No working models found' };
    }
    
    // Return with error message if failed
    if (!result.success) {
        return { ok: false, error: result.error || 'Model test failed' };
    }
    
    return { ok: true, model: currentModel };
}

async function postScanDiagnostic() {
    console.log('\n  🔬 POLARIS: Running post-scan diagnostic...');
    
    const issues = detectIssues();
    const repairResults = repairAll(issues);
    
    // Calculate health score
    const dataFiles = verifyDataFiles();
    const validFiles = Object.values(dataFiles).filter(f => f.valid).length;
    const totalFiles = Object.keys(dataFiles).length;
    const healthScore = Math.round((validFiles / totalFiles) * 100);
    
    // Update README
    updateReadmeHealth(healthScore, new Date().toISOString());
    
    console.log(`  ✓ Post-scan diagnostic: ${repairResults.succeeded} issues fixed, health ${healthScore}%`);
    
    return { 
        repaired: repairResults.succeeded, 
        healthScore, 
        issues: issues.length,
        repairs: repairResults.repairs
    };
}

module.exports = { 
    runFullDiagnostic, 
    preFlightCheck, 
    postScanDiagnostic,
    testGroqApi, 
    detectIssues,
    reportCriticalFailure,
    requestNewApi,
    updateReadmeHealth
};
