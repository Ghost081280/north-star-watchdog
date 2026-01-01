/**
 * NORTH STAR WATCHDOG - SELF-DIAGNOSTIC & REPAIR MODULE
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MODULE: Self-Awareness & Auto-Repair
 * ═══════════════════════════════════════════════════════════════
 * 
 * I monitor my own health and fix issues before they become problems.
 * When I can't fix something, I report to Command via GitHub Issues.
 * 
 * CAPABILITIES:
 * - Test GROQ API and auto-switch models if deprecated
 * - Test all OSINT APIs
 * - Verify data file integrity and fix corruption
 * - Detect and fix common issues (blanket sources, missing fields, etc.)
 * - Report unfixable issues via GitHub Issues
 * - Discover new APIs from GROQ cookbook
 * - Update README with health status
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCRIPTS_DIR = __dirname;
const DIAGNOSTIC_DIR = path.join(__dirname, '..', 'diagnostic');

// Known working GROQ models (in order of preference)
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-specdec', 
    'llama3-70b-8192',
    'mixtral-8x7b-32768'
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
const ALL_API_SOURCES = ['Google News', 'ProPublica Nonprofits', 'FEC', 'OIG Exclusions', 'OpenCorporates', 'USASpending'];

// ============================================
// GROQ API TESTING & AUTO-FIX
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
                        resolve({ success: false, error: json.error.message, model });
                    } else {
                        resolve({ success: true, model });
                    }
                } catch (e) {
                    resolve({ success: false, error: 'Parse error', model });
                }
            });
        });
        
        req.on('error', (e) => resolve({ success: false, error: e.message, model }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout', model }); });
        req.write(body);
        req.end();
    });
}

async function testGroqApi() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return { success: false, error: 'GROQ_API_KEY not set', fixable: false };
    }
    
    for (const model of GROQ_MODELS) {
        const result = await testGroqModel(apiKey, model);
        if (result.success) {
            return { success: true, model, message: `Model ${model} is working` };
        }
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
// DATA FILE VALIDATION & REPAIR
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

function writeJson(filename, data) {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
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
                fix: 'Remove flags with blanket sources, let new scan regenerate them'
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
    }
    
    // 3. Check for figures without allegations
    if (figures.valid && figures.data.people) {
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
    }
    
    // 4. Check for invalid statuses
    if (figures.valid && figures.data.people) {
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
            severity: 'warning',
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
            severity: 'warning',
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
    
    return issues;
}

// ============================================
// AUTO-REPAIR FUNCTIONS
// ============================================

function repairIssue(issue) {
    console.log(`  🔧 Attempting to fix: ${issue.id}`);
    
    switch (issue.id) {
        case 'blanket-sources':
            return repairBlanketSources();
        case 'journalists-in-figures':
            return repairJournalistsInFigures();
        case 'figures-no-allegations':
            return repairFiguresNoAllegations();
        case 'invalid-status':
            return repairInvalidStatus();
        case 'investigations-no-source':
            return repairInvestigationsNoSource();
        case 'stats-below-baseline':
        case 'stats-alleged-wrong':
            return repairStatsBaseline();
        default:
            return { success: false, message: 'No auto-fix available' };
    }
}

function repairBlanketSources() {
    try {
        const data = readJsonSafe('red-flags.json');
        if (!data.valid) return { success: false, message: 'Could not read file' };
        
        // Remove flags with all 6 sources (blanket attribution)
        const originalCount = data.data.flags.length;
        data.data.flags = data.data.flags.filter(f => 
            !f.apisUsed || f.apisUsed.length < 6
        );
        const removed = originalCount - data.data.flags.length;
        
        data.data.lastRepaired = new Date().toISOString();
        writeJson('red-flags.json', data.data);
        
        return { success: true, message: `Removed ${removed} flags with blanket sources` };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function repairJournalistsInFigures() {
    try {
        const data = readJsonSafe('figures.json');
        if (!data.valid) return { success: false, message: 'Could not read file' };
        
        const originalCount = data.data.people.length;
        data.data.people = data.data.people.filter(p => 
            !BLOCKED_JOURNALISTS.some(j => (p.name || '').toLowerCase().includes(j))
        );
        const removed = originalCount - data.data.people.length;
        
        data.data.lastRepaired = new Date().toISOString();
        writeJson('figures.json', data.data);
        
        return { success: true, message: `Removed ${removed} journalists` };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function repairFiguresNoAllegations() {
    try {
        const data = readJsonSafe('figures.json');
        if (!data.valid) return { success: false, message: 'Could not read file' };
        
        const originalCount = data.data.people.length;
        data.data.people = data.data.people.filter(p => 
            p.allegations && p.allegations.length > 0
        );
        const removed = originalCount - data.data.people.length;
        
        data.data.lastRepaired = new Date().toISOString();
        writeJson('figures.json', data.data);
        
        return { success: true, message: `Removed ${removed} figures without allegations` };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function repairInvalidStatus() {
    try {
        const data = readJsonSafe('figures.json');
        if (!data.valid) return { success: false, message: 'Could not read file' };
        
        const originalCount = data.data.people.length;
        data.data.people = data.data.people.filter(p => 
            p.status && VALID_STATUSES.includes(p.status.toLowerCase())
        );
        const removed = originalCount - data.data.people.length;
        
        data.data.lastRepaired = new Date().toISOString();
        writeJson('figures.json', data.data);
        
        return { success: true, message: `Removed ${removed} figures with invalid status` };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function repairInvestigationsNoSource() {
    try {
        const data = readJsonSafe('investigations.json');
        if (!data.valid) return { success: false, message: 'Could not read file' };
        
        const originalCount = data.data.cases.length;
        data.data.cases = data.data.cases.filter(c => 
            c.sourceUrl && c.sourceUrl.startsWith('http')
        );
        const removed = originalCount - data.data.cases.length;
        
        data.data.lastRepaired = new Date().toISOString();
        writeJson('investigations.json', data.data);
        
        return { success: true, message: `Removed ${removed} investigations without sources` };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

function repairStatsBaseline() {
    try {
        const data = readJsonSafe('stats.json');
        if (!data.valid) return { success: false, message: 'Could not read file' };
        
        // Reset to verified baseline
        data.data.charged = Math.max(70, data.data.charged || 0);
        data.data.convicted = Math.max(28, data.data.convicted || 0);
        data.data.alleged = '$9B+';
        data.data.activeCases = Math.max(5, data.data.activeCases || 0);
        data.data.source = 'U.S. Attorney Joe Thompson, Dec 2025';
        data.data.sourceUrl = 'https://www.cbsnews.com/minnesota/news/billions-paid-out-by-medicaid-in-minnesota-may-be-fraudulent-us-attorney/';
        data.data.lastRepaired = new Date().toISOString();
        
        writeJson('stats.json', data.data);
        
        return { success: true, message: 'Reset stats to verified baseline' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

// ============================================
// GITHUB ISSUE REPORTING
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
        
        // Update or add health badge
        const healthBadge = `[![System Health](https://img.shields.io/badge/Health-${healthScore}%25-${healthScore >= 80 ? 'brightgreen' : healthScore >= 60 ? 'yellow' : 'red'})](https://ghost081280.github.io/north-star-watchdog/diagnostic/)`;
        
        // Update or add last diagnostic badge
        const lastRun = new Date(lastDiagnostic).toISOString().split('T')[0];
        const diagnosticBadge = `[![Last Diagnostic](https://img.shields.io/badge/Last%20Check-${lastRun}-blue)](https://ghost081280.github.io/north-star-watchdog/diagnostic/)`;
        
        // Check if badges exist and update them
        if (readme.includes('![System Health]')) {
            readme = readme.replace(/\[!\[System Health\][^\]]*\]\([^)]*\)/g, healthBadge);
        }
        
        if (readme.includes('![Last Diagnostic]')) {
            readme = readme.replace(/\[!\[Last Diagnostic\][^\]]*\]\([^)]*\)/g, diagnosticBadge);
        }
        
        fs.writeFileSync(readmePath, readme);
        console.log(`  📝 README updated: Health ${healthScore}%`);
        return true;
    } catch (e) {
        console.log(`  ⚠ Could not update README: ${e.message}`);
        return false;
    }
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
        dataFiles: null
    };
    
    // 1. Test GROQ API
    console.log('  [1/5] Testing GROQ API...');
    results.groq = await testGroqApi();
    if (results.groq.success) {
        console.log(`    ✓ GROQ: ${results.groq.model} working`);
        results.tests.passed++;
        
        // Check if model needs updating in analyzer
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
            console.log(`    ❌ ${file}: Invalid JSON - ${status.error}`);
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
        else results.tests.warnings++;
    }
    
    // 5. Auto-repair fixable issues
    console.log('\n  [5/5] Auto-repairing fixable issues...');
    const fixableIssues = issues.filter(i => i.fixable);
    
    for (const issue of fixableIssues) {
        const repair = repairIssue(issue);
        if (repair.success) {
            console.log(`    ✓ Fixed: ${issue.id} - ${repair.message}`);
            results.repairs.push({ issue: issue.id, action: repair.message });
            // Reduce the test failure count since we fixed it
            if (issue.severity === 'error') results.tests.failed--;
            else if (issue.severity === 'warning') results.tests.warnings--;
            results.tests.passed++;
        } else {
            console.log(`    ❌ Could not fix: ${issue.id} - ${repair.message}`);
        }
    }
    
    // Calculate health score
    const totalTests = results.tests.passed + results.tests.warnings + results.tests.failed + results.tests.critical;
    results.healthScore = totalTests > 0 
        ? Math.round((results.tests.passed / totalTests) * 100)
        : 0;
    
    // Report unfixable critical issues to GitHub
    const unfixableCritical = results.issues.filter(i => 
        (i.severity === 'critical' || i.severity === 'error') && !i.fixable
    );
    
    if (unfixableCritical.length > 0) {
        const details = unfixableCritical.map(i => 
            `- **${i.component}**: ${i.description}\n  Fix: ${i.fix}`
        ).join('\n\n');
        await reportCriticalFailure('Unfixable Issues Detected', details);
    }
    
    // Summary
    console.log('\n  ══════════════════════════════════════════════════════');
    console.log(`  DIAGNOSTIC COMPLETE - Health: ${results.healthScore}%`);
    console.log(`  Passed: ${results.tests.passed} | Warnings: ${results.tests.warnings} | Failed: ${results.tests.failed} | Critical: ${results.tests.critical}`);
    console.log(`  Repairs made: ${results.repairs.length}`);
    console.log('  ══════════════════════════════════════════════════════\n');
    
    return results;
}

async function preFlightCheck() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { ok: false, error: 'No API key' };
    
    // Read current model from analyzer
    const analyzerPath = path.join(SCRIPTS_DIR, 'ai-analyzer.js');
    const content = fs.readFileSync(analyzerPath, 'utf8');
    const modelMatch = content.match(/model:\s*['"]([^'"]+)['"]/);
    const currentModel = modelMatch ? modelMatch[1] : 'unknown';
    
    // Test current model
    const result = await testGroqModel(apiKey, currentModel);
    
    if (!result.success && result.error?.includes('decommissioned')) {
        console.log(`  ⚠ Model ${currentModel} is decommissioned - finding replacement...`);
        
        for (const model of GROQ_MODELS) {
            const test = await testGroqModel(apiKey, model);
            if (test.success) {
                console.log(`  🔧 Found working model: ${model}`);
                const fix = fixGroqModel(model);
                if (fix.success) {
                    return { ok: true, fixed: true, model };
                }
            }
        }
        
        return { ok: false, error: 'No working models found' };
    }
    
    return { ok: result.success, model: currentModel };
}

// ============================================
// POST-SCAN DIAGNOSTIC (called after each scan)
// ============================================

async function postScanDiagnostic() {
    console.log('\n  🔬 POLARIS: Running post-scan diagnostic...');
    
    const issues = detectIssues();
    const fixable = issues.filter(i => i.fixable);
    
    let repaired = 0;
    for (const issue of fixable) {
        const result = repairIssue(issue);
        if (result.success) {
            console.log(`    ✓ Auto-fixed: ${issue.id}`);
            repaired++;
        }
    }
    
    // Calculate quick health score
    const dataFiles = verifyDataFiles();
    const validFiles = Object.values(dataFiles).filter(f => f.valid).length;
    const totalFiles = Object.keys(dataFiles).length;
    const healthScore = Math.round((validFiles / totalFiles) * 100);
    
    // Update README if health changed significantly
    updateReadmeHealth(healthScore, new Date().toISOString());
    
    console.log(`  ✓ Post-scan diagnostic: ${repaired} issues fixed, health ${healthScore}%`);
    
    return { repaired, healthScore, issues: issues.length };
}

module.exports = { 
    runFullDiagnostic, 
    preFlightCheck, 
    postScanDiagnostic,
    testGroqApi, 
    reportCriticalFailure,
    requestNewApi,
    detectIssues,
    repairIssue,
    updateReadmeHealth
};
