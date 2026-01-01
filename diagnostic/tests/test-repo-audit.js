/**
 * TEST MODULE: Deep Repo Audit
 * Comprehensive scan of all files, dependencies, and usage patterns
 */

DiagnosticCore.registerTest({
    id: 'repo-audit',
    name: 'DEEP REPO AUDIT',
    description: 'Scans entire repository structure, identifies orphaned files, checks dependencies',
    icon: '🔬',
    critical: false,
    
    async run(core) {
        core.log('Running deep repository audit...', 'info');
        
        // ============================================
        // SECTION 1: Data Files Inventory
        // ============================================
        core.log('Scanning data files...', 'info');
        
        const dataFiles = {
            // Core data files (should be updated hourly)
            core: [
                { name: 'news.json', purpose: 'News articles from Google RSS', updatedBy: 'ai-scraper.js' },
                { name: 'stats.json', purpose: 'Scandal statistics and briefing', updatedBy: 'ai-files.js' },
                { name: 'red-flags.json', purpose: 'AI-detected red flags', updatedBy: 'ai-files.js' },
                { name: 'figures.json', purpose: 'Key people in investigations', updatedBy: 'ai-files.js' },
                { name: 'investigations.json', purpose: 'Active fraud cases', updatedBy: 'ai-files.js' },
                { name: 'trending.json', purpose: 'Trending topics', updatedBy: 'ai-analyzer.js' },
                { name: 'story-ideas.json', purpose: 'AI-generated story leads', updatedBy: 'ai-files.js' }
            ],
            // System/learning files
            system: [
                { name: 'learning.json', purpose: 'Self-learning search queries and entities', updatedBy: 'ai-files.js' },
                { name: 'memory.json', purpose: 'AI consciousness memory', updatedBy: 'ai-consciousness.js' },
                { name: 'scan-history.json', purpose: 'History of scan results', updatedBy: 'ai-consciousness.js' }
            ],
            // Potentially orphaned/legacy files
            legacy: [
                { name: 'high-risk-programs.json', purpose: 'LEGACY: High risk programs list', updatedBy: 'NONE - possibly orphaned' },
                { name: 'search-terms.json', purpose: 'LEGACY: Search terms', updatedBy: 'NONE - possibly orphaned' }
            ]
        };
        
        let gridHtml = '<div class="audit-section"><h4>📁 Data Files Inventory</h4>';
        gridHtml += '<table class="audit-table"><tr><th>File</th><th>Purpose</th><th>Updated By</th><th>Status</th></tr>';
        
        // Check core files
        for (const file of dataFiles.core) {
            const data = await this.checkDataFile(core, file.name);
            const status = data.exists ? (data.hasTimestamp ? '✅ Active' : '⚠️ No timestamp') : '❌ Missing';
            const age = data.age ? core.formatAge(data.age) : 'N/A';
            gridHtml += `<tr class="${data.exists ? 'success' : 'error'}">
                <td><strong>${file.name}</strong></td>
                <td>${file.purpose}</td>
                <td><code>${file.updatedBy}</code></td>
                <td>${status} (${age})</td>
            </tr>`;
            
            core.addTest(this.id, `Core file: ${file.name}`, data.exists, 
                data.exists ? `Last updated: ${age}` : 'File missing');
        }
        
        // Check system files
        for (const file of dataFiles.system) {
            const data = await this.checkDataFile(core, file.name);
            const status = data.exists ? '✅' : '⚠️';
            gridHtml += `<tr class="${data.exists ? 'success' : 'warning'}">
                <td>${file.name}</td>
                <td>${file.purpose}</td>
                <td><code>${file.updatedBy}</code></td>
                <td>${status}</td>
            </tr>`;
        }
        
        // Check legacy files
        let orphanedFiles = [];
        for (const file of dataFiles.legacy) {
            const data = await this.checkDataFile(core, file.name);
            if (data.exists) {
                orphanedFiles.push(file.name);
                gridHtml += `<tr class="warning">
                    <td>⚠️ ${file.name}</td>
                    <td>${file.purpose}</td>
                    <td><code>${file.updatedBy}</code></td>
                    <td>🔍 Possibly orphaned</td>
                </tr>`;
            }
        }
        
        gridHtml += '</table></div>';
        
        if (orphanedFiles.length > 0) {
            core.addIssue('info', 'Potentially orphaned data files', 'data/',
                `Found ${orphanedFiles.length} files that may no longer be used: ${orphanedFiles.join(', ')}`,
                'Review if these files are needed. If not, consider removing them to reduce confusion.');
        }
        
        // ============================================
        // SECTION 2: Script Dependencies
        // ============================================
        gridHtml += '<div class="audit-section"><h4>📜 Backend Scripts</h4>';
        gridHtml += '<table class="audit-table"><tr><th>Script</th><th>Purpose</th><th>Dependencies</th></tr>';
        
        const scripts = [
            { name: 'ai-core.js', purpose: 'Main orchestrator - runs hourly', deps: ['ai-scraper', 'ai-analyzer', 'ai-osint', 'ai-files', 'ai-diagnostic', 'ai-twitter', 'ai-consciousness'] },
            { name: 'ai-scraper.js', purpose: 'Scrapes Google News RSS', deps: [] },
            { name: 'ai-analyzer.js', purpose: 'GROQ AI analysis', deps: ['GROQ API'] },
            { name: 'ai-osint.js', purpose: 'OSINT API enrichment (13 sources)', deps: ['ai-minnesota'] },
            { name: 'ai-minnesota.js', purpose: 'Minnesota-specific sources', deps: [] },
            { name: 'ai-files.js', purpose: 'Updates all data/*.json files', deps: [] },
            { name: 'ai-diagnostic.js', purpose: 'Self-healing diagnostics', deps: [] },
            { name: 'ai-consciousness.js', purpose: 'AI reflection and memory', deps: [] },
            { name: 'ai-twitter.js', purpose: 'X/Twitter integration', deps: ['Twitter API'] },
            { name: 'ai-repair.js', purpose: 'Self-repair utilities', deps: [] }
        ];
        
        for (const script of scripts) {
            gridHtml += `<tr>
                <td><strong>${script.name}</strong></td>
                <td>${script.purpose}</td>
                <td>${script.deps.length > 0 ? script.deps.map(d => `<code>${d}</code>`).join(', ') : '<em>None</em>'}</td>
            </tr>`;
        }
        
        gridHtml += '</table></div>';
        
        // ============================================
        // SECTION 3: Frontend Files
        // ============================================
        gridHtml += '<div class="audit-section"><h4>🖥️ Frontend Files</h4>';
        gridHtml += '<table class="audit-table"><tr><th>File</th><th>Purpose</th><th>Loads Data From</th></tr>';
        
        const frontendFiles = [
            { name: 'index.html', purpose: 'Main dashboard', loadsFrom: 'All data/*.json files' },
            { name: 'styles.css', purpose: 'Main stylesheet', loadsFrom: 'N/A' },
            { name: 'app/app-core.js', purpose: 'Core utilities and init', loadsFrom: 'All data/*.json' },
            { name: 'app/app-render.js', purpose: 'Renders all UI sections', loadsFrom: 'DATA global object' },
            { name: 'app/app-search.js', purpose: 'Search functionality', loadsFrom: 'USASpending, ProPublica, FEC APIs' },
            { name: 'app/app-research.js', purpose: 'Deep Research feature', loadsFrom: 'Google News RSS' },
            { name: 'js/investigation-package.js', purpose: 'Investigation report generator', loadsFrom: 'Multiple APIs' }
        ];
        
        for (const file of frontendFiles) {
            gridHtml += `<tr>
                <td><strong>${file.name}</strong></td>
                <td>${file.purpose}</td>
                <td>${file.loadsFrom}</td>
            </tr>`;
        }
        
        gridHtml += '</table></div>';
        
        // ============================================
        // SECTION 4: OSINT Sources Status
        // ============================================
        gridHtml += '<div class="audit-section"><h4>🔍 OSINT Sources (13 Total)</h4>';
        
        const osintSources = {
            federal: [
                { name: 'ProPublica Nonprofits', api: 'Free', checked: true },
                { name: 'FEC Campaign Finance', api: 'Free (key required)', checked: true },
                { name: 'OIG Exclusions', api: 'Free', checked: true },
                { name: 'USASpending', api: 'Free', checked: true },
                { name: 'SEC EDGAR', api: 'Free', checked: true },
                { name: 'OSHA', api: 'Free', checked: true },
                { name: 'FDA', api: 'Free', checked: true },
                { name: 'HUD', api: 'Free', checked: true },
                { name: 'OpenCorporates', api: 'Free (limited)', checked: true }
            ],
            minnesota: [
                { name: 'MN Campaign Finance Board', api: 'Free', checked: true },
                { name: 'MN DHS Licensing', api: 'Free', checked: true },
                { name: 'MN Transparency Portal', api: 'Free', checked: true }
            ],
            news: [
                { name: 'Google News RSS', api: 'Free', checked: true }
            ]
        };
        
        // Check red-flags.json for actual sources used
        const redFlagsData = core.DATA.redflags;
        const sourcesChecked = redFlagsData?.sourcesChecked || [];
        const sourcesUsed = redFlagsData?.sourcesUsed || [];
        
        gridHtml += `<div class="source-summary">
            <div class="source-stat"><strong>${sourcesChecked.length}</strong> sources checked</div>
            <div class="source-stat"><strong>${sourcesUsed.length}</strong> returned data</div>
            <div class="source-stat"><strong>${Math.round(sourcesUsed.length/sourcesChecked.length*100) || 0}%</strong> hit rate</div>
        </div>`;
        
        gridHtml += '<div class="source-grid">';
        
        const allSources = [...osintSources.federal, ...osintSources.minnesota, ...osintSources.news];
        for (const source of allSources) {
            const isChecked = sourcesChecked.some(s => s.includes(source.name.split(' ')[0]));
            const hasData = sourcesUsed.some(s => s.includes(source.name.split(' ')[0]));
            const statusClass = hasData ? 'success' : (isChecked ? 'warning' : 'error');
            const statusIcon = hasData ? '✅' : (isChecked ? '⚠️' : '❌');
            
            gridHtml += `<div class="source-card ${statusClass}">
                <div class="source-name">${statusIcon} ${source.name}</div>
                <div class="source-api">${source.api}</div>
            </div>`;
        }
        
        gridHtml += '</div></div>';
        
        // ============================================
        // SECTION 5: Workflow Status
        // ============================================
        gridHtml += '<div class="audit-section"><h4>⚙️ GitHub Actions Workflow</h4>';
        
        const workflowInfo = `
            <div class="workflow-info">
                <p><strong>Workflow:</strong> <code>.github/workflows/ai-updater.yml</code></p>
                <p><strong>Schedule:</strong> Every hour (cron: 0 * * * *)</p>
                <p><strong>Main Script:</strong> <code>node scripts/ai-core.js</code></p>
                <p><strong>Required Secrets:</strong></p>
                <ul>
                    <li><code>GROQ_API_KEY</code> - AI analysis (REQUIRED)</li>
                    <li><code>GITHUB_TOKEN</code> - Auto-provided</li>
                    <li><code>X_*</code> - Twitter integration (optional)</li>
                </ul>
            </div>
        `;
        
        gridHtml += workflowInfo + '</div>';
        
        // ============================================
        // SECTION 6: Known Issues & Recommendations
        // ============================================
        gridHtml += '<div class="audit-section"><h4>💡 Analysis & Recommendations</h4>';
        gridHtml += '<div class="recommendations">';
        
        // Check for rate limit issues
        if (core.DATA.trending?.topics?.length <= 1) {
            gridHtml += `<div class="rec-item warning">
                <strong>⚠️ GROQ Rate Limits:</strong> AI analysis appears limited. Trending topics (${core.DATA.trending?.topics?.length || 0}) 
                and story ideas are not being fully populated. Consider upgrading GROQ tier or reducing prompt size.
            </div>`;
            core.addTest(this.id, 'AI generating enough trending topics', false, 
                `Only ${core.DATA.trending?.topics?.length || 0} topic(s)`);
        } else {
            core.addTest(this.id, 'AI generating enough trending topics', true, 
                `${core.DATA.trending?.topics?.length} topics`);
        }
        
        // Check OSINT hit rate
        const hitRate = sourcesChecked.length > 0 ? (sourcesUsed.length / sourcesChecked.length * 100) : 0;
        if (hitRate < 50) {
            gridHtml += `<div class="rec-item warning">
                <strong>⚠️ Low OSINT Hit Rate (${Math.round(hitRate)}%):</strong> Less than half of OSINT sources are returning data.
                This could be due to API changes, rate limits, or search query issues.
            </div>`;
        }
        
        // Check for orphaned files
        if (orphanedFiles.length > 0) {
            gridHtml += `<div class="rec-item info">
                <strong>ℹ️ Legacy Files:</strong> Found ${orphanedFiles.length} potentially orphaned files: ${orphanedFiles.join(', ')}.
                Consider removing these if they're no longer used.
            </div>`;
        }
        
        // Check data freshness
        const newsAge = core.getAge(core.DATA.news?.lastUpdated);
        const oneHour = 60 * 60 * 1000;
        if (newsAge > 2 * oneHour) {
            gridHtml += `<div class="rec-item error">
                <strong>❌ Stale Data:</strong> News data is ${core.formatAge(newsAge)} old. Workflow may not be running.
            </div>`;
        } else {
            gridHtml += `<div class="rec-item success">
                <strong>✅ Data Fresh:</strong> Last update ${core.formatAge(newsAge)} ago. Workflow is running normally.
            </div>`;
        }
        
        gridHtml += '</div></div>';
        
        // Add custom styles for this test
        gridHtml += `
            <style>
                .audit-section { margin: 20px 0; padding: 15px; background: rgba(255,255,255,0.03); border-radius: 8px; }
                .audit-section h4 { margin: 0 0 15px 0; color: var(--gold); }
                .audit-table { width: 100%; border-collapse: collapse; font-size: 13px; }
                .audit-table th { text-align: left; padding: 8px; background: rgba(0,0,0,0.3); color: var(--gold); }
                .audit-table td { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); }
                .audit-table tr.success td:first-child { border-left: 3px solid #22c55e; }
                .audit-table tr.warning td:first-child { border-left: 3px solid #f59e0b; }
                .audit-table tr.error td:first-child { border-left: 3px solid #ef4444; }
                .audit-table code { background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 11px; }
                
                .source-summary { display: flex; gap: 20px; margin-bottom: 15px; }
                .source-stat { background: rgba(0,0,0,0.3); padding: 10px 15px; border-radius: 6px; }
                .source-stat strong { color: var(--gold); font-size: 18px; }
                
                .source-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
                .source-card { padding: 10px; border-radius: 6px; background: rgba(0,0,0,0.2); }
                .source-card.success { border-left: 3px solid #22c55e; }
                .source-card.warning { border-left: 3px solid #f59e0b; }
                .source-card.error { border-left: 3px solid #ef4444; }
                .source-name { font-weight: 600; margin-bottom: 4px; }
                .source-api { font-size: 11px; opacity: 0.7; }
                
                .workflow-info { background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; }
                .workflow-info code { background: rgba(212,175,55,0.2); padding: 2px 6px; border-radius: 4px; }
                .workflow-info ul { margin: 10px 0 0 20px; }
                
                .recommendations { display: flex; flex-direction: column; gap: 10px; }
                .rec-item { padding: 12px 15px; border-radius: 6px; }
                .rec-item.success { background: rgba(34,197,94,0.1); border-left: 3px solid #22c55e; }
                .rec-item.warning { background: rgba(245,158,11,0.1); border-left: 3px solid #f59e0b; }
                .rec-item.error { background: rgba(239,68,68,0.1); border-left: 3px solid #ef4444; }
                .rec-item.info { background: rgba(59,130,246,0.1); border-left: 3px solid #3b82f6; }
            </style>
        `;
        
        core.setDetail(this.id, gridHtml);
        core.setStatus(this.id, 'pass');
    },
    
    async checkDataFile(core, filename) {
        // Map filename to DATA key
        const keyMap = {
            'news.json': 'news',
            'stats.json': 'stats',
            'red-flags.json': 'redflags',
            'figures.json': 'figures',
            'investigations.json': 'investigations',
            'trending.json': 'trending',
            'story-ideas.json': 'storyideas',
            'learning.json': 'learning'
        };
        
        const key = keyMap[filename];
        const data = key ? core.DATA[key] : null;
        
        return {
            exists: !!data,
            hasTimestamp: !!data?.lastUpdated,
            age: data?.lastUpdated ? core.getAge(data.lastUpdated) : null
        };
    }
});
