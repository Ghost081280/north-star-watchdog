/**
 * NORTH STAR WATCHDOG - SELF-DIAGNOSTIC MODULE
 * 
 * Agent Polaris self-healing capabilities.
 * Tests all systems and either fixes issues or reports them to Command.
 * 
 * CAPABILITIES:
 * - Test GROQ API and detect model deprecation
 * - Test all OSINT APIs
 * - Verify data file integrity
 * - Auto-fix known issues
 * - Report unfixable issues via GitHub Issues
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Known working GROQ models (in order of preference)
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-70b-specdec', 
    'llama3-70b-8192',
    'mixtral-8x7b-32768'
];

/**
 * Test GROQ API and find a working model
 */
async function testGroqApi() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return { success: false, error: 'GROQ_API_KEY not set', fixable: false };
    }
    
    for (const model of GROQ_MODELS) {
        try {
            const result = await testGroqModel(apiKey, model);
            if (result.success) {
                return { success: true, model, message: `Model ${model} is working` };
            }
        } catch (e) {
            continue;
        }
    }
    
    return { success: false, error: 'All GROQ models failed', fixable: false };
}

/**
 * Test a specific GROQ model
 */
function testGroqModel(apiKey, model) {
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

/**
 * Auto-fix GROQ model in ai-analyzer.js
 */
function fixGroqModel(workingModel) {
    const analyzerPath = path.join(__dirname, 'ai-analyzer.js');
    
    try {
        let content = fs.readFileSync(analyzerPath, 'utf8');
        
        // Find and replace the model string
        const modelRegex = /model:\s*['"]([^'"]+)['"]/g;
        const currentModel = content.match(modelRegex);
        
        if (currentModel) {
            content = content.replace(modelRegex, `model: '${workingModel}'`);
            fs.writeFileSync(analyzerPath, content);
            return { success: true, message: `Updated model to ${workingModel}` };
        }
        
        return { success: false, error: 'Could not find model string in ai-analyzer.js' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Test OSINT APIs
 */
async function testOsintApis() {
    const results = {
        propublica: false,
        fec: false,
        oig: false,
        opencorporates: false,
        usaspending: false
    };
    
    // Quick test each API
    const tests = [
        { name: 'propublica', url: 'https://projects.propublica.org/nonprofits/api/v2/search.json?q=test' },
        { name: 'fec', url: 'https://api.open.fec.gov/v1/candidates/search/?q=test&api_key=DEMO_KEY' },
        { name: 'opencorporates', url: 'https://api.opencorporates.com/v0.4/companies/search?q=test' }
    ];
    
    for (const test of tests) {
        try {
            const result = await quickHttpTest(test.url);
            results[test.name] = result.success;
        } catch (e) {
            results[test.name] = false;
        }
    }
    
    return results;
}

/**
 * Quick HTTP test
 */
function quickHttpTest(url) {
    return new Promise((resolve) => {
        const client = url.startsWith('https') ? https : require('http');
        const req = client.get(url, { timeout: 10000 }, (res) => {
            resolve({ success: res.statusCode === 200 || res.statusCode === 201 });
        });
        req.on('error', () => resolve({ success: false }));
        req.on('timeout', () => { req.destroy(); resolve({ success: false }); });
    });
}

/**
 * Verify data files exist and are valid JSON
 */
function verifyDataFiles() {
    const required = ['news.json', 'figures.json', 'investigations.json', 'stats.json', 'red-flags.json', 'learning.json'];
    const results = {};
    
    for (const file of required) {
        const filepath = path.join(DATA_DIR, file);
        try {
            if (fs.existsSync(filepath)) {
                const content = fs.readFileSync(filepath, 'utf8');
                JSON.parse(content); // Validate JSON
                results[file] = { exists: true, valid: true };
            } else {
                results[file] = { exists: false, valid: false };
            }
        } catch (e) {
            results[file] = { exists: true, valid: false, error: e.message };
        }
    }
    
    return results;
}

/**
 * Create GitHub issue for critical failure
 */
async function reportCriticalFailure(title, details) {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPOSITORY;
    
    if (!token || !repo) {
        console.log('  ⚠ Cannot report to Command - GITHUB_TOKEN not set');
        return;
    }
    
    const body = `## 🚨 POLARIS SYSTEM ALERT

**Commander,**

I've encountered a critical system failure that requires your attention.

---

### ⚠️ Issue Details

${details}

### 🔧 Attempted Auto-Fix

I attempted to resolve this automatically but was unable to do so.

### 📋 Required Action

Please review and manually resolve this issue. The hourly scan cannot complete until this is fixed.

---

*— Agent Polaris*
*Diagnostic System*
*${new Date().toISOString()}*`;

    const [owner, repoName] = repo.split('/');
    
    const postData = JSON.stringify({
        title: `🚨 SYSTEM ALERT: ${title}`,
        body,
        labels: ['polaris-alert', 'critical', 'needs-fix']
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
                    console.log('  📡 POLARIS: System alert sent to Command');
                }
                resolve();
            });
        });
        
        req.on('error', () => resolve());
        req.write(postData);
        req.end();
    });
}

/**
 * Run full diagnostic
 */
async function runDiagnostic() {
    console.log('\n  🔬 POLARIS SELF-DIAGNOSTIC');
    console.log('  ─────────────────────────────');
    
    const issues = [];
    
    // Test GROQ
    console.log('  Testing GROQ API...');
    const groqResult = await testGroqApi();
    if (!groqResult.success) {
        console.log(`  ❌ GROQ: ${groqResult.error}`);
        issues.push({ component: 'GROQ', error: groqResult.error, fixable: false });
    } else {
        console.log(`  ✓ GROQ: ${groqResult.model} working`);
        
        // Check if we need to update the model in the file
        const analyzerPath = path.join(__dirname, 'ai-analyzer.js');
        const content = fs.readFileSync(analyzerPath, 'utf8');
        if (!content.includes(groqResult.model)) {
            console.log(`  🔧 Auto-fixing: Updating model to ${groqResult.model}`);
            const fixResult = fixGroqModel(groqResult.model);
            if (fixResult.success) {
                console.log(`  ✓ ${fixResult.message}`);
            } else {
                issues.push({ component: 'GROQ Model Update', error: fixResult.error, fixable: false });
            }
        }
    }
    
    // Test OSINT APIs
    console.log('  Testing OSINT APIs...');
    const osintResults = await testOsintApis();
    const osintWorking = Object.entries(osintResults).filter(([k, v]) => v).length;
    console.log(`  ✓ OSINT: ${osintWorking}/${Object.keys(osintResults).length} APIs responding`);
    
    // Verify data files
    console.log('  Verifying data files...');
    const fileResults = verifyDataFiles();
    const filesOk = Object.values(fileResults).filter(f => f.valid).length;
    console.log(`  ✓ Data files: ${filesOk}/${Object.keys(fileResults).length} valid`);
    
    // Report critical issues
    if (issues.length > 0) {
        const criticalIssues = issues.filter(i => !i.fixable);
        if (criticalIssues.length > 0) {
            const details = criticalIssues.map(i => `- **${i.component}**: ${i.error}`).join('\n');
            await reportCriticalFailure('Critical System Failure', details);
        }
    }
    
    console.log('  ─────────────────────────────');
    console.log(`  Diagnostic complete: ${issues.length} issues found\n`);
    
    return { issues, groqResult, osintResults, fileResults };
}

/**
 * Quick pre-flight check before main scan
 */
async function preFlightCheck() {
    // Just test GROQ quickly
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { ok: false, error: 'No API key' };
    
    // Read current model from analyzer
    const analyzerPath = path.join(__dirname, 'ai-analyzer.js');
    const content = fs.readFileSync(analyzerPath, 'utf8');
    const modelMatch = content.match(/model:\s*['"]([^'"]+)['"]/);
    const currentModel = modelMatch ? modelMatch[1] : 'unknown';
    
    // Test current model
    const result = await testGroqModel(apiKey, currentModel);
    
    if (!result.success && result.error?.includes('decommissioned')) {
        console.log(`  ⚠ Model ${currentModel} is decommissioned - finding replacement...`);
        
        // Find working model
        for (const model of GROQ_MODELS) {
            const test = await testGroqModel(apiKey, model);
            if (test.success) {
                console.log(`  🔧 Found working model: ${model}`);
                const fix = fixGroqModel(model);
                if (fix.success) {
                    console.log(`  ✓ Auto-fixed: ${fix.message}`);
                    return { ok: true, fixed: true, model };
                }
            }
        }
        
        return { ok: false, error: 'No working models found' };
    }
    
    return { ok: result.success, model: currentModel };
}

module.exports = { runDiagnostic, preFlightCheck, testGroqApi, reportCriticalFailure };
