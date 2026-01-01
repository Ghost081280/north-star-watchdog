/**
 * TEST MODULE: API Connectivity
 * Checks status of OSINT API integrations
 */

DiagnosticCore.registerTest({
    id: 'api-connectivity',
    name: 'API CONNECTIVITY STATUS',
    description: 'Checks which OSINT APIs are returning data based on sourcesUsed/sourcesChecked',
    icon: '🌐',
    critical: false,
    
    async run(core) {
        core.log('Testing API connectivity status...', 'info');
        
        const sourcesUsed = core.DATA.redflags?.sourcesUsed || [];
        const sourcesChecked = core.DATA.redflags?.sourcesChecked || [];
        
        let activeCount = 0;
        let checkedCount = 0;
        let apiDetails = [];
        
        core.EXPECTED_SOURCES.forEach(api => {
            const isUsed = sourcesUsed.includes(api);
            const isChecked = sourcesChecked.includes(api);
            
            if (isUsed) activeCount++;
            if (isChecked) checkedCount++;
            
            apiDetails.push({
                name: api,
                status: isUsed ? 'active' : (isChecked ? 'checked' : 'unknown'),
                returning: isUsed
            });
            
            core.addTest(this.id, `${api}`, isUsed ? true : (isChecked ? 'warn' : false),
                isUsed ? 'Returning data' : (isChecked ? 'Checked, no data' : 'Not checked'));
        });
        
        // Summary checks
        core.addTest(this.id, 'Multiple APIs returning data', activeCount > 1,
            `${activeCount}/${core.EXPECTED_SOURCES.length} active`);
        
        core.addTest(this.id, 'All APIs being checked', checkedCount === core.EXPECTED_SOURCES.length,
            `${checkedCount}/${core.EXPECTED_SOURCES.length} checked`);
        
        if (activeCount <= 1) {
            core.addIssue('warning', 'Low API coverage', 'scripts/ai-osint.js',
                `Only ${activeCount} APIs returning data. OSINT enrichment is limited.`,
                'Check enrichFindings(). APIs may be rate-limited or returning empty results.');
        }
        
        if (checkedCount < core.EXPECTED_SOURCES.length) {
            core.addIssue('warning', 'Not all APIs checked', 'scripts/ai-osint.js',
                `Only ${checkedCount}/${core.EXPECTED_SOURCES.length} APIs being checked`,
                'Verify all API functions are being called in enrichFindings()');
        }
        
        // DISPLAY: API status grid
        let detailHtml = `
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:10px; margin-top:15px;">
                ${apiDetails.map(api => {
                    const color = api.status === 'active' ? '#198754' : (api.status === 'checked' ? '#ffc107' : '#dc3545');
                    const bg = api.status === 'active' ? '#0f5132' : (api.status === 'checked' ? '#664d03' : '#842029');
                    return `
                        <div style="padding:12px; background:${bg}; border-left:3px solid ${color};">
                            <div style="font-size:11px; color:#fff;">${api.name}</div>
                            <div style="font-size:10px; color:#ccc; margin-top:5px;">
                                ${api.status === 'active' ? '✓ Returning data' : (api.status === 'checked' ? '⚠ No data' : '✗ Not checked')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            <div class="data-grid" style="margin-top:15px;">
                <div class="data-card ${activeCount > 1 ? 'success' : 'warning'}">
                    <div class="data-card-title">Active APIs</div>
                    <div class="data-card-value">${activeCount}</div>
                    <div class="data-card-detail">Returning data</div>
                </div>
                <div class="data-card ${checkedCount === core.EXPECTED_SOURCES.length ? 'success' : 'warning'}">
                    <div class="data-card-title">Checked APIs</div>
                    <div class="data-card-value">${checkedCount}</div>
                    <div class="data-card-detail">of ${core.EXPECTED_SOURCES.length} total</div>
                </div>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, activeCount > 1 ? 'pass' : 'warn');
    }
});
