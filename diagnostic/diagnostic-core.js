/**
 * NORTH STAR WATCHDOG - DIAGNOSTIC CORE ENGINE
 * v5.0 - Manages all diagnostic modules and test execution
 * 
 * This is the brain of the diagnostic system. It:
 * - Loads and manages all test modules
 * - Tracks results across all tests
 * - Generates reports for humans and AI
 * - Provides utilities for all test modules
 */

const DiagnosticCore = {
    // ============================================
    // STATE
    // ============================================
    DATA: {},
    RESULTS: { pass: 0, fail: 0, warn: 0, critical: 0, total: 0 },
    ISSUES: [],
    LOG: [],
    TESTS: [],
    
    // ============================================
    // CONSTANTS
    // ============================================
    EXPECTED_SOURCES: [
        'Google News',
        'ProPublica Nonprofits',
        'FEC',
        'OIG Exclusions',
        'OpenCorporates',
        'USASpending'
    ],
    
    VERIFIED_BASELINE: {
        charged: 70,
        convicted: 28,
        alleged: '$9B+',
        activeCases: 5,
        source: 'U.S. Attorney Joe Thompson, Dec 2025',
        sourceUrl: 'https://www.cbsnews.com/minnesota/news/billions-paid-out-by-medicaid-in-minnesota-may-be-fraudulent-us-attorney/'
    },
    
    BLOCKED_JOURNALISTS: ['nick shirley'],
    BLOCKED_GENERIC: ['unknown', 'minnesota child care providers', 'various', 'multiple'],
    VALID_STATUSES: ['charged', 'convicted', 'sentenced', 'indicted'],
    VALID_ALLEGATIONS: ['wire fraud', 'money laundering', 'federal program fraud', 'false claims', 'conspiracy', 'tax fraud', 'embezzlement', 'mail fraud', 'bank fraud'],
    
    DATA_FILES: ['stats', 'investigations', 'figures', 'trending', 'story-ideas', 'red-flags', 'news', 'learning'],
    
    // ============================================
    // INITIALIZATION
    // ============================================
    init() {
        this.log('Diagnostic v5.0 initialized. Click RUN FULL DIAGNOSTIC to begin.', 'info');
        this.setupRawDataButtons();
    },
    
    registerTest(testModule) {
        this.TESTS.push(testModule);
        this.createTestSection(testModule);
    },
    
    createTestSection(testModule) {
        const container = document.getElementById('test-sections');
        const section = document.createElement('div');
        section.className = 'section';
        section.id = `section-${testModule.id}`;
        section.innerHTML = `
            <div class="section-header">
                <div>
                    <span class="section-title">${testModule.icon || ''} ${testModule.name}</span>
                    ${testModule.description ? `<div class="section-desc">${testModule.description}</div>` : ''}
                </div>
                <span class="status status-pending" id="status-${testModule.id}">PENDING</span>
            </div>
            <div class="section-content">
                <div id="tests-${testModule.id}"></div>
                <div id="detail-${testModule.id}"></div>
            </div>
        `;
        container.appendChild(section);
    },
    
    setupRawDataButtons() {
        const container = document.getElementById('raw-data-buttons');
        this.DATA_FILES.forEach(file => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-small';
            btn.textContent = file + '.json';
            btn.onclick = () => this.showRawData(file);
            container.appendChild(btn);
        });
    },
    
    // ============================================
    // TEST EXECUTION
    // ============================================
    async runAll() {
        this.resetState();
        document.getElementById('run-btn').disabled = true;
        document.getElementById('progress-bar').style.display = 'block';
        document.getElementById('run-time').textContent = 'Running: ' + new Date().toLocaleString();
        
        this.log('Starting comprehensive diagnostic...', 'info');
        
        // Load all data first
        await this.loadAllData();
        
        // Run all registered tests
        const totalTests = this.TESTS.length;
        for (let i = 0; i < totalTests; i++) {
            const test = this.TESTS[i];
            const pct = Math.round(((i + 1) / totalTests) * 100);
            this.updateProgress(pct, `Testing ${test.name}...`);
            
            try {
                await test.run(this);
            } catch (e) {
                this.log(`Error in ${test.name}: ${e.message}`, 'fail');
            }
            
            this.updateSummary();
            await this.sleep(50);
        }
        
        this.updateProgress(100, 'Complete');
        this.displayIssues();
        this.generateAIExport();
        
        this.log(`Diagnostic complete: ${this.RESULTS.pass} passed, ${this.RESULTS.fail} failed, ${this.RESULTS.warn} warnings, ${this.RESULTS.critical} critical`, 
            this.RESULTS.critical > 0 ? 'critical' : (this.RESULTS.fail > 0 ? 'fail' : 'pass'));
        
        document.getElementById('run-time').textContent = 'Completed: ' + new Date().toLocaleString();
        document.getElementById('run-btn').disabled = false;
    },
    
    async runQuick() {
        this.resetState();
        this.log('Running quick check...', 'info');
        
        await this.loadAllData();
        
        // Run only critical tests
        const quickTests = this.TESTS.filter(t => t.critical === true);
        for (const test of quickTests) {
            try {
                await test.run(this);
            } catch (e) {
                this.log(`Error in ${test.name}: ${e.message}`, 'fail');
            }
        }
        
        this.updateSummary();
        this.displayIssues();
        this.log('Quick check complete', 'pass');
    },
    
    resetState() {
        this.RESULTS = { pass: 0, fail: 0, warn: 0, critical: 0, total: 0 };
        this.ISSUES = [];
        this.LOG = [];
        document.getElementById('log-output').innerHTML = '';
        document.querySelectorAll('[id^="tests-"]').forEach(el => el.innerHTML = '');
        document.querySelectorAll('[id^="detail-"]').forEach(el => el.innerHTML = '');
        document.querySelectorAll('[id^="status-"]').forEach(el => {
            el.className = 'status status-pending';
            el.textContent = 'PENDING';
        });
    },
    
    // ============================================
    // DATA LOADING
    // ============================================
    async loadAllData() {
        this.log('Loading data files...', 'info');
        
        for (const file of this.DATA_FILES) {
            const key = file.replace(/-/g, '');
            this.DATA[key] = await this.loadJson(file);
        }
        
        this.log(`Loaded ${Object.keys(this.DATA).length} data files`, 'pass');
    },
    
    async loadJson(filename) {
        try {
            const res = await fetch(`../data/${filename}.json?t=${Date.now()}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            this.log(`Failed to load ${filename}.json: ${e.message}`, 'fail');
            return null;
        }
    },
    
    // ============================================
    // TEST HELPERS
    // ============================================
    addTest(moduleId, name, result, detail = '', fix = '') {
        this.RESULTS.total++;
        let status = 'pass';
        
        if (result === true) { this.RESULTS.pass++; status = 'pass'; }
        else if (result === false) { this.RESULTS.fail++; status = 'fail'; }
        else if (result === 'warn') { this.RESULTS.warn++; status = 'warn'; }
        else if (result === 'critical') { this.RESULTS.critical++; this.RESULTS.fail++; status = 'critical'; }
        
        const container = document.getElementById(`tests-${moduleId}`);
        if (container) {
            const rowClass = status === 'critical' ? 'critical' : (status === 'warn' ? 'warning' : '');
            container.innerHTML += `
                <div class="test-row ${rowClass}">
                    <div class="test-info">
                        <div class="test-name">${this.escapeHtml(name)}</div>
                        ${detail ? `<div class="test-detail">${this.escapeHtml(detail)}</div>` : ''}
                        ${fix ? `<div class="test-fix">Fix: ${this.escapeHtml(fix)}</div>` : ''}
                    </div>
                    <span class="status status-${status}">${status.toUpperCase()}</span>
                </div>
            `;
        }
        
        return status;
    },
    
    addIssue(severity, title, location, description, fix) {
        this.ISSUES.push({ severity, title, location, description, fix, timestamp: new Date().toISOString() });
    },
    
    setStatus(moduleId, status) {
        const el = document.getElementById(`status-${moduleId}`);
        if (el) {
            el.className = 'status status-' + status;
            el.textContent = status.toUpperCase();
        }
    },
    
    setDetail(moduleId, html) {
        const el = document.getElementById(`detail-${moduleId}`);
        if (el) el.innerHTML = html;
    },
    
    // ============================================
    // UI UPDATES
    // ============================================
    log(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        this.LOG.push({ time, msg, type });
        const el = document.getElementById('log-output');
        el.innerHTML += `<div class="log-line"><span class="log-time">${time}</span><span class="log-${type}">${this.escapeHtml(msg)}</span></div>`;
        el.scrollTop = el.scrollHeight;
    },
    
    updateProgress(pct, text = null) {
        const fill = document.getElementById('progress-fill');
        fill.style.width = pct + '%';
        fill.textContent = text || (pct + '%');
    },
    
    updateSummary() {
        document.getElementById('pass-count').textContent = this.RESULTS.pass;
        document.getElementById('warn-count').textContent = this.RESULTS.warn;
        document.getElementById('fail-count').textContent = this.RESULTS.fail;
        document.getElementById('critical-count').textContent = this.RESULTS.critical;
        document.getElementById('total-count').textContent = this.RESULTS.total;
        
        document.getElementById('sum-pass').className = 'summary-item' + (this.RESULTS.pass > 0 ? ' pass' : '');
        document.getElementById('sum-warn').className = 'summary-item' + (this.RESULTS.warn > 0 ? ' warn' : '');
        document.getElementById('sum-fail').className = 'summary-item' + (this.RESULTS.fail > 0 ? ' fail' : '');
        document.getElementById('sum-critical').className = 'summary-item' + (this.RESULTS.critical > 0 ? ' critical' : '');
        
        // Health bar
        const total = this.RESULTS.total || 1;
        document.getElementById('health-pass').style.width = ((this.RESULTS.pass / total) * 100) + '%';
        document.getElementById('health-warn').style.width = ((this.RESULTS.warn / total) * 100) + '%';
        document.getElementById('health-fail').style.width = (((this.RESULTS.fail) / total) * 100) + '%';
    },
    
    displayIssues() {
        const section = document.getElementById('issues-section');
        const list = document.getElementById('issues-list');
        const count = document.getElementById('issues-count');
        
        if (this.ISSUES.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        count.textContent = this.ISSUES.length;
        count.className = 'status status-' + (this.ISSUES.some(i => i.severity === 'critical') ? 'critical' : 'fail');
        
        // Sort by severity
        const sorted = [...this.ISSUES].sort((a, b) => {
            const order = { critical: 0, error: 1, warning: 2, info: 3 };
            return (order[a.severity] || 4) - (order[b.severity] || 4);
        });
        
        list.innerHTML = sorted.map(i => `
            <div class="issue-card ${i.severity === 'warning' ? 'warning' : (i.severity === 'info' ? 'info' : '')}">
                <div class="issue-title">[${i.severity.toUpperCase()}] ${this.escapeHtml(i.title)}</div>
                <div class="issue-location">Location: <span class="test-code">${this.escapeHtml(i.location)}</span></div>
                <div class="issue-desc">${this.escapeHtml(i.description)}</div>
                <div class="issue-fix">
                    <div class="issue-fix-title">Suggested Fix:</div>
                    ${this.escapeHtml(i.fix)}
                </div>
            </div>
        `).join('');
    },
    
    showCritical() {
        const critical = this.ISSUES.filter(i => i.severity === 'critical');
        const panel = document.getElementById('critical-panel');
        const list = document.getElementById('critical-issues-list');
        
        if (critical.length === 0) {
            alert('No critical issues found!');
            return;
        }
        
        panel.style.display = 'block';
        list.innerHTML = critical.map(i => `
            <div class="issue-card">
                <div class="issue-title">${this.escapeHtml(i.title)}</div>
                <div class="issue-location">Location: <span class="test-code">${this.escapeHtml(i.location)}</span></div>
                <div class="issue-desc">${this.escapeHtml(i.description)}</div>
                <div class="issue-fix">
                    <div class="issue-fix-title">Suggested Fix:</div>
                    ${this.escapeHtml(i.fix)}
                </div>
            </div>
        `).join('');
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    
    // ============================================
    // EXPORT & REPORTING
    // ============================================
    generateAIExport() {
        const timestamp = new Date().toISOString();
        
        let report = `NORTH STAR WATCHDOG - DIAGNOSTIC REPORT FOR AI
================================================
Generated: ${timestamp}
Version: 5.0

SUMMARY
-------
Passed: ${this.RESULTS.pass}
Warnings: ${this.RESULTS.warn}
Failed: ${this.RESULTS.fail}
Critical: ${this.RESULTS.critical}
Total Tests: ${this.RESULTS.total}
Health: ${Math.round((this.RESULTS.pass / this.RESULTS.total) * 100)}%

`;

        if (this.ISSUES.length > 0) {
            report += `ISSUES REQUIRING FIXES (${this.ISSUES.length})
========================================

`;
            this.ISSUES.forEach((issue, i) => {
                report += `ISSUE ${i + 1}: ${issue.title}
Severity: ${issue.severity.toUpperCase()}
Location: ${issue.location}
Problem: ${issue.description}
Fix: ${issue.fix}

`;
            });
        } else {
            report += `NO ISSUES FOUND - All tests passed!

`;
        }

        report += `
DATA SNAPSHOTS
==============

--- stats.json ---
${JSON.stringify(this.DATA.stats, null, 2)}

--- red-flags.json (summary) ---
Flags count: ${this.DATA.redflags?.flags?.length || 0}
Sources used: ${JSON.stringify(this.DATA.redflags?.sourcesUsed || [])}
Sources checked: ${JSON.stringify(this.DATA.redflags?.sourcesChecked || [])}

--- figures.json (summary) ---
People count: ${this.DATA.figures?.people?.length || 0}
Names: ${(this.DATA.figures?.people || []).map(p => p.name).join(', ')}

--- investigations.json (summary) ---
Cases count: ${this.DATA.investigations?.cases?.length || 0}
Names: ${(this.DATA.investigations?.cases || []).map(c => c.name).join(', ')}

--- trending.json (summary) ---
Topics count: ${this.DATA.trending?.topics?.length || 0}

--- story-ideas.json (summary) ---
Ideas count: ${this.DATA.storyideas?.ideas?.length || 0}

--- news.json (summary) ---
Articles count: ${this.DATA.news?.articles?.length || 0}
Has breaking: ${!!this.DATA.news?.breaking}

--- learning.json (summary) ---
Search queries: ${this.DATA.learning?.searchQueries?.length || 0}
Tracked entities: ${this.DATA.learning?.trackedEntities?.length || 0}

`;

        report += `
AI INSTRUCTIONS
===============
1. Review each ISSUE above carefully
2. For each issue, locate the file specified in "Location"
3. Apply the suggested fix
4. Run the diagnostic again to verify
5. Commit changes only if all critical tests pass

PRIORITY ORDER:
1. Fix all CRITICAL issues first
2. Then fix ERROR issues
3. Then address WARNINGS
4. INFO items are optional improvements

CRITICAL ISSUES TO FIX FIRST:
${this.ISSUES.filter(i => i.severity === 'critical').map(i => `- ${i.title} in ${i.location}`).join('\n') || 'None'}

`;

        document.getElementById('ai-export').textContent = report;
    },
    
    copyReport() {
        const report = document.getElementById('ai-export').textContent;
        navigator.clipboard.writeText(report).then(() => {
            this.log('Report copied to clipboard!', 'pass');
            alert('Report copied to clipboard!');
        }).catch(e => {
            this.log('Copy failed: ' + e.message, 'fail');
        });
    },
    
    exportForAI() {
        this.generateAIExport();
        document.getElementById('ai-export').scrollIntoView({ behavior: 'smooth' });
    },
    
    async showRawData(filename) {
        const preview = document.getElementById('raw-data-preview');
        const key = filename.replace(/-/g, '');
        
        if (this.DATA[key]) {
            preview.textContent = JSON.stringify(this.DATA[key], null, 2);
        } else {
            try {
                const res = await fetch(`../data/${filename}.json?t=${Date.now()}`);
                const data = await res.json();
                preview.textContent = JSON.stringify(data, null, 2);
            } catch (e) {
                preview.textContent = `Error loading ${filename}.json: ${e.message}`;
            }
        }
    },
    
    // ============================================
    // UTILITIES
    // ============================================
    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    
    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleString();
        } catch {
            return dateStr;
        }
    },
    
    getAge(dateStr) {
        if (!dateStr) return Infinity;
        try {
            return Date.now() - new Date(dateStr).getTime();
        } catch {
            return Infinity;
        }
    },
    
    formatAge(ms) {
        if (ms === Infinity) return 'Unknown';
        const mins = Math.floor(ms / (1000 * 60));
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (mins > 0) return `${mins} min${mins > 1 ? 's' : ''} ago`;
        return 'Just now';
    },
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Make available globally
window.DiagnosticCore = DiagnosticCore;
