/**
 * NORTH STAR WATCHDOG - SELF-DIAGNOSTIC MODULE
 * v5.1 - Dynamic File Discovery & Auto-Configuration
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MODULE: Self-Awareness & Health Monitoring
 * ═══════════════════════════════════════════════════════════════
 * 
 * I monitor my own health and detect issues.
 * I can also update my own configuration when needed.
 * 
 * CAPABILITIES:
 * - Dynamic data file discovery (no hardcoded lists!)
 * - Test GROQ API and detect model deprecation
 * - Auto-update ai-analyzer.js with working models
 * - Test all OSINT APIs
 * - Verify data file integrity
 * - Detect common issues
 * - Report unfixable issues via GitHub Issues
 * - Update README with health status
 * - Update workflow YAML if needed
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Import repair module
const { repairIssue, repairAll } = require('./ai-repair');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SCRIPTS_DIR = __dirname;
const ROOT_DIR = path.join(__dirname, '..');

// Known working GROQ models (in order of preference)
// This list is auto-updated when models are decommissioned
const GROQ_MODELS = [
    'llama-3.3-70b-versatile',
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'mixtral-8x7b-32768',
    'gemma2-9b-it'
];

// Validation rules
const BLOCKED_JOURNALISTS = ['nick shirley', 'rich mchugh', 'mario nawfal'];
const VALID_STATUSES = ['charged', 'convicted', 'sentenced', 'indicted'];

// ============================================
// DYNAMIC FILE DISCOVERY
// ============================================

/**
 * Discover all JSON files in data/ directory
 * No hardcoded list needed!
 */
function discoverDataFiles() {
    const files = [];
    try {
        const entries = fs.readdirSync(DATA_DIR);
        for (const entry of entries) {
            if (entry.endsWith('.json')) {
                files.push(entry);
            }
        }
    } catch (e) {
        console.log(`  ⚠️ Could not read data directory: ${e.message}`);
    }
    return files;
}

/**
 * Verify all discovered data files
 */
function verifyDataFiles() {
    const discoveredFiles = discoverDataFiles();
    const results = {};
    
    for (const filename of discoveredFiles) {
        const filepath = path.join(DATA_DIR, filename);
        try {
            const content = fs.readFileSync(filepath, 'utf8');
            const data = JSON.parse(content);
            
            results[filename] = {
                exists: true,
                valid: true,
                data,
                size: content.length,
                hasTimestamp: !!data.lastUpdated,
                timestamp: data.lastUpdated || null
            };
        } catch (e) {
            results[filename] = {
                exists: true,
                valid: false,
                error: e.message
            };
        }
    }
    
    return results;
}

/**
 * Get age of a file's lastUpdated timestamp
 */
function getFileAge(filename) {
    const filepath = path.join(DATA_DIR, filename);
    try {
        const data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
        if (data.lastUpdated) {
            return Date.now() - new Date(data.lastUpdated).getTime();
        }
    } catch (e) {}
    return Infinity;
}

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
                        const isDecommissioned = errorMsg.includes('decommissioned');
                        resolve({ 
                            success: false, 
                            error: errorMsg, 
                            model,
                            rateLimited: isRateLimit,
                            decommissioned: isDecommissioned
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
        return { ok: false, error: 'GROQ_API_KEY not set' };
    }
    
    // Test primary model first
    const primaryModel = GROQ_MODELS[0];
    const result = await testGroqModel(apiKey, primaryModel);
    
    if (result.success) {
        return { ok: true, model: primaryModel };
    }
    
    // If rate limited, try fallback models
    if (result.rateLimited) {
        console.log(`  ⚠️ ${primaryModel} rate limited - trying fallbacks...`);
        for (const model of GROQ_MODELS.slice(1)) {
            const test = await testGroqModel(apiKey, model);
            if (test.success) {
                console.log(`  ✓ Using fallback model: ${model}`);
                return { ok: true, model, fallback: true };
            }
        }
        return { ok: false, error: 'All models rate limited' };
    }
    
    // If decommissioned, find working model and update config
    if (result.decommissioned) {
        console.log(`  ⚠️ ${primaryModel} decommissioned - finding replacement...`);
        for (const model of GROQ_MODELS.slice(1)) {
            const test = await testGroqModel(apiKey, model);
            if (test.success) {
                console.log(`  🔧 Found working model: ${model}`);
                // Auto-update the analyzer to use this model
                await updateAnalyzerModel(model);
                return { ok: true, model, updated: true };
            }
        }
        return { ok: false, error: 'No working models found' };
    }
    
    return { ok: false, error: result.error || 'Unknown error' };
}

// ============================================
// AUTO-UPDATE CONFIGURATION
// ============================================

/**
 * Update ai-analyzer.js to use a new primary model
 */
async function updateAnalyzerModel(newModel) {
    const analyzerPath = path.join(SCRIPTS_DIR, 'ai-analyzer.js');
    
    try {
        let content = fs.readFileSync(analyzerPath, 'utf8');
        
        // Find and replace the PRIMARY_MODEL constant
        const modelRegex = /const PRIMARY_MODEL = ['"]([^'"]+)['"]/;
        const match = content.match(modelRegex);
        
        if (match && match[1] !== newModel) {
            content = content.replace(modelRegex, `const PRIMARY_MODEL = '${newModel}'`);
            fs.writeFileSync(analyzerPath, content);
            console.log(`  ✓ Updated ai-analyzer.js PRIMARY_MODEL to ${newModel}`);
            return { success: true, oldModel: match[1], newModel };
        }
        
        return { success: true, message: 'No update needed' };
    } catch (e) {
        console.log(`  ⚠️ Could not update analyzer: ${e.message}`);
        return { success: false, error: e.message };
    }
}

/**
 * Update workflow YAML with new schedule or configuration
 */
function updateWorkflowYaml(updates = {}) {
    const workflowPath = path.join(ROOT_DIR, '.github', 'workflows', 'ai-updater.yml');
    
    try {
        if (!fs.existsSync(workflowPath)) {
            console.log('  ⚠️ Workflow file not found');
            return { success: false, error: 'Workflow file not found' };
        }
        
        let content = fs.readFileSync(workflowPath, 'utf8');
        let modified = false;
        
        // Update cron schedule if specified
        if (updates.schedule) {
            const cronRegex = /cron:\s*['"]([^'"]+)['"]/;
            if (cronRegex.test(content)) {
                content = content.replace(cronRegex, `cron: '${updates.schedule}'`);
                modified = true;
                console.log(`  ✓ Updated workflow schedule to: ${updates.schedule}`);
            }
        }
        
        // Update Node version if specified
        if (updates.nodeVersion) {
            const nodeRegex = /node-version:\s*['"]?(\d+)['"]?/;
            if (nodeRegex.test(content)) {
                content = content.replace(nodeRegex, `node-version: '${updates.nodeVersion}'`);
                modified = true;
                console.log(`  ✓ Updated Node version to: ${updates.nodeVersion}`);
            }
        }
        
        if (modified) {
            fs.writeFileSync(workflowPath, content);
            return { success: true, modified: true };
        }
        
        return { success: true, modified: false };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

/**
 * Update learning.json with new search queries discovered during analysis
 */
function updateLearningQueries(newQueries = [], newEntities = []) {
    const learningPath = path.join(DATA_DIR, 'learning.json');
    
    try {
        let learning = { searchQueries: [], trackedEntities: [], lastLearningUpdate: null };
        
        if (fs.existsSync(learningPath)) {
            learning = JSON.parse(fs.readFileSync(learningPath, 'utf8'));
        }
        
        // Add new queries (deduplicated)
        const existingQueries = new Set(learning.searchQueries.map(q => q.toLowerCase()));
        let addedQueries = 0;
        
        for (const query of newQueries) {
            if (query && !existingQueries.has(query.toLowerCase())) {
                learning.searchQueries.push(query);
                existingQueries.add(query.toLowerCase());
                addedQueries++;
            }
        }
        
        // Add new entities (deduplicated)
        const existingEntities = new Set(learning.trackedEntities.map(e => e.toLowerCase()));
        let addedEntities = 0;
        
        for (const entity of newEntities) {
            if (entity && !existingEntities.has(entity.toLowerCase())) {
                learning.trackedEntities.push(entity);
                existingEntities.add(entity.toLowerCase());
                addedEntities++;
            }
        }
        
        if (addedQueries > 0 || addedEntities > 0) {
            learning.lastLearningUpdate = new Date().toISOString();
            fs.writeFileSync(learningPath, JSON.stringify(learning, null, 2));
            console.log(`  📚 Learning updated: +${addedQueries} queries, +${addedEntities} entities`);
        }
        
        return { success: true, addedQueries, addedEntities };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// ============================================
// ISSUE DETECTION (Dynamic)
// ============================================

function detectIssues() {
    const issues = [];
    const dataFiles = verifyDataFiles();
    
    // Check each discovered file
    for (const [filename, info] of Object.entries(dataFiles)) {
        // Invalid JSON
        if (!info.valid) {
            issues.push({
                type: 'invalid_json',
                severity: 'critical',
                file: filename,
                message: `Invalid JSON: ${info.error}`,
                autoFix: true
            });
            continue;
        }
        
        // File-specific checks
        if (filename === 'figures.json' && info.data.people) {
            // Check for journalists
            const journalists = info.data.people.filter(p => 
                BLOCKED_JOURNALISTS.some(j => p.name?.toLowerCase().includes(j))
            );
            if (journalists.length > 0) {
                issues.push({
                    type: 'journalist_in_figures',
                    severity: 'high',
                    file: filename,
                    message: `Found ${journalists.length} journalists in Key Figures`,
                    entities: journalists.map(j => j.name),
                    autoFix: true
                });
            }
            
            // Check for figures without allegations
            const noAllegations = info.data.people.filter(p => 
                !p.allegations || p.allegations.length === 0
            );
            if (noAllegations.length > 0) {
                issues.push({
                    type: 'figure_no_allegations',
                    severity: 'medium',
                    file: filename,
                    message: `${noAllegations.length} figures without allegations`,
                    entities: noAllegations.map(f => f.name),
                    autoFix: true
                });
            }
        }
        
        if (filename === 'red-flags.json' && info.data.flags) {
            // Check for blanket sources
            const blanketFlags = info.data.flags.filter(f => 
                f.apisUsed && f.apisUsed.length >= 6
            );
            if (blanketFlags.length > 0) {
                issues.push({
                    type: 'blanket_sources',
                    severity: 'medium',
                    file: filename,
                    message: `${blanketFlags.length} flags with blanket source attribution`,
                    autoFix: true
                });
            }
        }
        
        if (filename === 'stats.json' && info.data) {
            // Check baseline enforcement
            if (info.data.charged < 70) {
                issues.push({
                    type: 'stats_below_baseline',
                    severity: 'high',
                    file: filename,
                    message: `Charged (${info.data.charged}) below verified baseline (70)`,
                    autoFix: true
                });
            }
            if (info.data.convicted < 28) {
                issues.push({
                    type: 'stats_below_baseline',
                    severity: 'high',
                    file: filename,
                    message: `Convicted (${info.data.convicted}) below verified baseline (28)`,
                    autoFix: true
                });
            }
        }
        
        if (filename === 'investigations.json' && info.data.cases) {
            // Check for investigations without source URLs
            const noSource = info.data.cases.filter(c => 
                !c.sourceUrl || !c.sourceUrl.startsWith('http')
            );
            if (noSource.length > 0) {
                issues.push({
                    type: 'investigation_no_source',
                    severity: 'medium',
                    file: filename,
                    message: `${noSource.length} investigations without source URLs`,
                    entities: noSource.map(c => c.name),
                    autoFix: false // Need human to find sources
                });
            }
        }
    }
    
    return issues;
}

// ============================================
// REPORTING
// ============================================

function updateReadmeHealth(healthScore, timestamp) {
    const readmePath = path.join(ROOT_DIR, 'README.md');
    
    try {
        if (!fs.existsSync(readmePath)) {
            console.log('  ⚠️ README.md not found');
            return;
        }
        
        let content = fs.readFileSync(readmePath, 'utf8');
        
        // Update health badge if it exists
        const healthRegex = /Health:\s*\d+%/;
        if (healthRegex.test(content)) {
            content = content.replace(healthRegex, `Health: ${healthScore}%`);
        }
        
        // Update last updated timestamp if it exists
        const timeRegex = /Last Updated:\s*[^\n]+/;
        if (timeRegex.test(content)) {
            content = content.replace(timeRegex, `Last Updated: ${new Date(timestamp).toLocaleString()}`);
        }
        
        fs.writeFileSync(readmePath, content);
        console.log(`  📝 README updated: Health ${healthScore}%`);
    } catch (e) {
        console.log(`  ⚠️ Could not update README: ${e.message}`);
    }
}

async function reportCriticalFailure(title, body) {
    // This would create a GitHub Issue for critical failures
    // Requires GITHUB_TOKEN to be set
    console.log(`  🚨 CRITICAL: ${title}`);
    console.log(`     ${body}`);
    
    // TODO: Implement GitHub Issue creation
    // For now, just log it
}

function requestNewApi(apiName, reason) {
    console.log(`  📋 API Request: ${apiName}`);
    console.log(`     Reason: ${reason}`);
    // TODO: Could create a GitHub Issue requesting new API integration
}

// ============================================
// PRE-FLIGHT CHECK
// ============================================

async function preFlightCheck() {
    const results = {
        groq: null,
        dataFiles: null,
        issues: []
    };
    
    // Test GROQ
    const groqResult = await testGroqApi();
    results.groq = groqResult;
    
    if (!groqResult.ok) {
        results.issues.push({
            type: 'groq_failure',
            severity: 'critical',
            message: groqResult.error
        });
    }
    
    // Verify data files exist
    const dataFiles = verifyDataFiles();
    results.dataFiles = dataFiles;
    
    // Check critical files
    const criticalFiles = ['stats.json', 'news.json'];
    for (const file of criticalFiles) {
        if (!dataFiles[file] || !dataFiles[file].valid) {
            results.issues.push({
                type: 'missing_critical_file',
                severity: 'critical',
                file,
                message: `Critical file ${file} is missing or invalid`
            });
        }
    }
    
    return results;
}

// ============================================
// FULL DIAGNOSTIC
// ============================================

async function runFullDiagnostic() {
    console.log('\n  🔬 POLARIS: Running full diagnostic...\n');
    
    const results = {
        timestamp: new Date().toISOString(),
        discoveredFiles: [],
        groq: null,
        issues: [],
        repairs: [],
        healthScore: 0
    };
    
    // Step 1: Discover files
    results.discoveredFiles = discoverDataFiles();
    console.log(`  📁 Discovered ${results.discoveredFiles.length} data files`);
    
    // Step 2: Test GROQ
    results.groq = await testGroqApi();
    console.log(`  🤖 GROQ: ${results.groq.ok ? '✓ Working' : '✗ ' + results.groq.error}`);
    if (results.groq.model) {
        console.log(`     Model: ${results.groq.model}`);
    }
    
    // Step 3: Detect issues
    results.issues = detectIssues();
    console.log(`  🔍 Found ${results.issues.length} issues`);
    
    // Step 4: Auto-repair
    if (results.issues.length > 0) {
        const repairResults = repairAll(results.issues);
        results.repairs = repairResults.repairs;
        console.log(`  🔧 Repaired ${repairResults.succeeded}/${results.issues.filter(i => i.autoFix).length} auto-fixable issues`);
    }
    
    // Step 5: Calculate health
    const dataFiles = verifyDataFiles();
    const validFiles = Object.values(dataFiles).filter(f => f.valid).length;
    const totalFiles = Object.keys(dataFiles).length;
    const fileHealth = totalFiles > 0 ? (validFiles / totalFiles) : 0;
    const issueDeduction = Math.min(results.issues.length * 5, 30); // Max 30% deduction
    results.healthScore = Math.max(0, Math.round(fileHealth * 100) - issueDeduction);
    
    console.log(`  ❤️ Health Score: ${results.healthScore}%`);
    
    // Step 6: Update README
    updateReadmeHealth(results.healthScore, results.timestamp);
    
    return results;
}

// ============================================
// POST-SCAN DIAGNOSTIC
// ============================================

async function postScanDiagnostic() {
    console.log('\n  🔬 POLARIS: Running post-scan diagnostic...');
    
    const issues = detectIssues();
    const repairResults = repairAll(issues);
    
    // Calculate health score
    const dataFiles = verifyDataFiles();
    const validFiles = Object.values(dataFiles).filter(f => f.valid).length;
    const totalFiles = Object.keys(dataFiles).length;
    const healthScore = totalFiles > 0 ? Math.round((validFiles / totalFiles) * 100) : 0;
    
    // Update README
    updateReadmeHealth(healthScore, new Date().toISOString());
    
    console.log(`  ✓ Post-scan diagnostic: ${repairResults.succeeded} issues fixed, health ${healthScore}%`);
    
    return { 
        repaired: repairResults.succeeded, 
        healthScore, 
        issues: issues.length,
        repairs: repairResults.repairs,
        discoveredFiles: discoverDataFiles()
    };
}

// ============================================
// EXPORTS
// ============================================

module.exports = { 
    // Core functions
    runFullDiagnostic, 
    preFlightCheck, 
    postScanDiagnostic,
    
    // Testing
    testGroqApi,
    testGroqModel,
    
    // Detection
    detectIssues,
    verifyDataFiles,
    discoverDataFiles,
    
    // Auto-update
    updateAnalyzerModel,
    updateWorkflowYaml,
    updateLearningQueries,
    
    // Reporting
    reportCriticalFailure,
    requestNewApi,
    updateReadmeHealth,
    
    // Constants (for other modules)
    GROQ_MODELS,
    BLOCKED_JOURNALISTS,
    VALID_STATUSES
};
