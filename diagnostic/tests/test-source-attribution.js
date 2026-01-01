/**
 * TEST MODULE: API Source Attribution
 * Verifies each finding shows accurate sources, not blanket "all 6 APIs"
 */

DiagnosticCore.registerTest({
    id: 'sources',
    name: 'API SOURCE ATTRIBUTION',
    description: 'Verifies per-entity source tracking and accurate API attribution',
    icon: '🔌',
    critical: true,
    
    async run(core) {
        core.log('Testing API source attribution...', 'info');
        let allPassed = true;
        
        if (!core.DATA.redflags?.flags?.length) {
            core.addTest(this.id, 'Red flags data available', false);
            core.setStatus(this.id, 'fail');
            return;
        }
        
        const flags = core.DATA.redflags.flags;
        const globalSourcesUsed = core.DATA.redflags.sourcesUsed || [];
        const globalSourcesChecked = core.DATA.redflags.sourcesChecked || [];
        
        // ============================================
        // CHECK 1: Global sources tracking
        // ============================================
        core.addTest(this.id, 'Global sourcesUsed array populated', globalSourcesUsed.length > 0,
            globalSourcesUsed.length > 0 ? `Sources: ${globalSourcesUsed.join(', ')}` : 'EMPTY - OSINT not running');
        
        core.addTest(this.id, 'Global sourcesChecked array populated', globalSourcesChecked.length > 0,
            globalSourcesChecked.length > 0 ? `Checked: ${globalSourcesChecked.join(', ')}` : 'EMPTY');
        
        if (globalSourcesUsed.length === 0) {
            allPassed = false;
            core.addIssue('error', 'No OSINT sources returned data', 'scripts/ai-osint.js',
                'sourcesUsed is empty. The OSINT APIs are not returning any data.',
                'Check enrichFindings(). APIs may be failing or returning empty results.');
        }
        
        // ============================================
        // CHECK 2: Per-flag attribution analysis
        // ============================================
        let properAttrib = 0;
        let blanket = 0;
        let googleOnly = 0;
        let noApis = 0;
        
        flags.forEach(f => {
            if (!f.apisUsed || f.apisUsed.length === 0) {
                noApis++;
            } else if (f.apisUsed.length === 6) {
                blanket++;
            } else if (f.apisUsed.length === 1 && f.apisUsed[0] === 'Google News') {
                googleOnly++;
                properAttrib++;
            } else {
                properAttrib++;
            }
        });
        
        core.addTest(this.id, 'Flags have apisUsed array', noApis === 0,
            noApis === 0 ? 'All flags have apisUsed' : `${noApis} flags missing apisUsed`);
        
        core.addTest(this.id, 'Per-entity source tracking working', properAttrib > 0,
            `${properAttrib}/${flags.length} with proper attribution`);
        
        // ============================================
        // CHECK 3: Blanket attribution (THE BUG)
        // ============================================
        if (blanket > 0) {
            core.addTest(this.id, 'No blanket "all 6 sources" (BUG CHECK)', false,
                `${blanket} flags showing all 6 sources - THIS IS THE BUG`);
            allPassed = false;
            
            core.addIssue('critical', 'Blanket source attribution detected', 'scripts/ai-analyzer.js + ai-files.js',
                `${blanket}/${flags.length} red flags show all 6 sources. This happens when:
1. ai-analyzer.js sets apisUsed to sourcesChecked (all 6) before ai-files.js processes
2. ai-files.js getSourcesForRedFlag() isn't being called
3. entitySources from ai-osint.js is empty`,
                `FIX ORDER:
1. In ai-analyzer.js: Remove "apisUsed: osintResults?.sourcesChecked" from processedFlags
2. In ai-files.js: Ensure getSourcesForRedFlag(rf, entitySources) is called
3. In ai-osint.js: Verify entitySources is populated for each entity`);
        } else {
            core.addTest(this.id, 'No blanket "all 6 sources"', true, 'Proper per-entity tracking');
        }
        
        // ============================================
        // CHECK 4: Expected sources present
        // ============================================
        for (const src of core.EXPECTED_SOURCES) {
            const inUsed = globalSourcesUsed.includes(src);
            const inChecked = globalSourcesChecked.includes(src);
            
            core.addTest(this.id, `${src} integration`, inUsed ? true : (inChecked ? 'warn' : false),
                inUsed ? 'Returning data' : (inChecked ? 'Checked but no data' : 'Not checked'));
        }
        
        // ============================================
        // DISPLAY: Source breakdown
        // ============================================
        const detailHtml = `
            <div style="margin-top:15px;">
                <div style="color:#d4af37; font-size:11px; margin-bottom:10px;">SOURCE ATTRIBUTION BREAKDOWN:</div>
                <div class="data-grid">
                    <div class="data-card ${properAttrib > 0 ? 'success' : 'error'}">
                        <div class="data-card-title">Properly Attributed</div>
                        <div class="data-card-value">${properAttrib}</div>
                        <div class="data-card-detail">Flags with accurate sources</div>
                    </div>
                    <div class="data-card ${blanket > 0 ? 'error' : 'success'}">
                        <div class="data-card-title">Blanket (BUG)</div>
                        <div class="data-card-value">${blanket}</div>
                        <div class="data-card-detail">Showing all 6 incorrectly</div>
                    </div>
                    <div class="data-card ${googleOnly > flags.length / 2 ? 'warning' : ''}">
                        <div class="data-card-title">Google Only</div>
                        <div class="data-card-value">${googleOnly}</div>
                        <div class="data-card-detail">Only Google News found data</div>
                    </div>
                    <div class="data-card ${noApis > 0 ? 'error' : ''}">
                        <div class="data-card-title">No Sources</div>
                        <div class="data-card-value">${noApis}</div>
                        <div class="data-card-detail">Missing apisUsed array</div>
                    </div>
                </div>
                
                <div style="margin-top:15px; color:#888; font-size:10px;">
                    <strong>Global Sources Used:</strong> ${globalSourcesUsed.join(', ') || 'None'}<br>
                    <strong>Global Sources Checked:</strong> ${globalSourcesChecked.join(', ') || 'None'}
                </div>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
