/**
 * TEST MODULE: Minnesota Sources
 * Tests Minnesota-specific OSINT integrations:
 * - MN Campaign Finance Board
 * - MN DHS Licensing
 * - MN Transparency Portal
 * - Political donation cross-reference functionality
 */

DiagnosticCore.registerTest({
    id: 'minnesota-sources',
    name: 'MINNESOTA SOURCES',
    description: 'Tests MN Campaign Finance, DHS Licensing, and Transparency Portal integration',
    icon: '🏛️',
    critical: false,
    
    async run(core) {
        core.log('Testing Minnesota source integrations...', 'info');
        
        const MN_SOURCES = [
            'MN Campaign Finance',
            'MN DHS Licensing', 
            'MN Transparency'
        ];
        
        const sourcesUsed = core.DATA.redflags?.sourcesUsed || [];
        const sourcesChecked = core.DATA.redflags?.sourcesChecked || [];
        
        let mnActiveCount = 0;
        let mnCheckedCount = 0;
        let sourceDetails = [];
        
        // Test each Minnesota source
        MN_SOURCES.forEach(source => {
            const isUsed = sourcesUsed.includes(source);
            const isChecked = sourcesChecked.includes(source);
            
            if (isUsed) mnActiveCount++;
            if (isChecked) mnCheckedCount++;
            
            sourceDetails.push({
                name: source,
                status: isUsed ? 'active' : (isChecked ? 'checked' : 'not_checked'),
                returning: isUsed
            });
            
            core.addTest(this.id, source, isUsed ? true : (isChecked ? 'warn' : false),
                isUsed ? 'Returning data' : (isChecked ? 'Checked, no data found' : 'Not being checked'));
        });
        
        // Test: At least one MN source should be checked
        core.addTest(this.id, 'MN sources being queried', mnCheckedCount > 0,
            `${mnCheckedCount}/${MN_SOURCES.length} MN sources checked`);
        
        // Test: Check for political donation cross-reference capability
        const hasInvestigationPackage = typeof window !== 'undefined' && 
            (window.InvestigationPackage || window.quickInvestigate);
        core.addTest(this.id, 'Investigation package available', hasInvestigationPackage || 'warn',
            hasInvestigationPackage ? 'Frontend investigation tools loaded' : 'Check js/investigation-package.js');
        
        // Test: Check if red flags include political donation patterns
        const redFlags = core.DATA.redflags?.flags || [];
        const hasPoliticalFlags = redFlags.some(flag => 
            flag.type?.includes('POLITICAL') || 
            flag.description?.toLowerCase().includes('donation') ||
            flag.description?.toLowerCase().includes('campaign')
        );
        core.addTest(this.id, 'Political donation detection', hasPoliticalFlags || 'warn',
            hasPoliticalFlags ? 'Political donation patterns being detected' : 'No political patterns found yet');
        
        // Test: Check for CCAP-related analysis
        const hasCCAPAnalysis = redFlags.some(flag =>
            flag.description?.toLowerCase().includes('ccap') ||
            flag.description?.toLowerCase().includes('childcare') ||
            flag.description?.toLowerCase().includes('daycare')
        );
        core.addTest(this.id, 'CCAP fraud pattern detection', hasCCAPAnalysis || 'warn',
            hasCCAPAnalysis ? 'CCAP patterns being analyzed' : 'No CCAP patterns found yet');
        
        // Generate issues if needed
        if (mnCheckedCount === 0) {
            core.addIssue('warning', 'Minnesota sources not checked', 'scripts/ai-minnesota.js',
                'No Minnesota-specific sources are being queried',
                'Ensure ai-minnesota.js is properly integrated with ai-osint.js');
        }
        
        if (!hasInvestigationPackage) {
            core.addIssue('info', 'Investigation package not loaded', 'js/investigation-package.js',
                'Frontend investigation tools not detected',
                'Ensure investigation-package.js is included in index.html');
        }
        
        // DISPLAY: Minnesota sources status
        let detailHtml = `
            <div style="margin-bottom:15px;">
                <div style="font-size:12px; color:#d4af37; margin-bottom:10px;">Minnesota OSINT Sources</div>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
                    ${sourceDetails.map(src => {
                        const statusColor = src.status === 'active' ? '#198754' : 
                            (src.status === 'checked' ? '#ffc107' : '#dc3545');
                        const statusBg = src.status === 'active' ? '#0f5132' : 
                            (src.status === 'checked' ? '#664d03' : '#842029');
                        const statusIcon = src.status === 'active' ? '✓' : 
                            (src.status === 'checked' ? '⚠' : '✗');
                        return `
                            <div style="padding:12px; background:${statusBg}; border-left:3px solid ${statusColor}; border-radius:4px;">
                                <div style="font-size:11px; color:#fff; font-weight:500;">${src.name}</div>
                                <div style="font-size:10px; color:#ccc; margin-top:5px;">
                                    ${statusIcon} ${src.status === 'active' ? 'Active' : (src.status === 'checked' ? 'No data' : 'Not checked')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <div style="font-size:12px; color:#d4af37; margin-bottom:10px;">Feature Status</div>
            <div class="data-grid">
                <div class="data-card ${mnCheckedCount > 0 ? 'success' : 'warning'}">
                    <div class="data-card-title">MN Sources</div>
                    <div class="data-card-value">${mnCheckedCount}/${MN_SOURCES.length}</div>
                    <div class="data-card-detail">Being checked</div>
                </div>
                <div class="data-card ${hasInvestigationPackage ? 'success' : 'warning'}">
                    <div class="data-card-title">Investigation UI</div>
                    <div class="data-card-value">${hasInvestigationPackage ? '✓' : '✗'}</div>
                    <div class="data-card-detail">${hasInvestigationPackage ? 'Loaded' : 'Not loaded'}</div>
                </div>
                <div class="data-card ${hasPoliticalFlags ? 'success' : 'info'}">
                    <div class="data-card-title">Political XRef</div>
                    <div class="data-card-value">${hasPoliticalFlags ? '✓' : '—'}</div>
                    <div class="data-card-detail">${hasPoliticalFlags ? 'Active' : 'Pending data'}</div>
                </div>
            </div>
            
            <div style="margin-top:15px; padding:12px; background:#1a1a1a; border-radius:6px; font-size:11px; color:#888;">
                <strong style="color:#d4af37;">Minnesota Source URLs:</strong><br>
                • Campaign Finance: <a href="https://cfb.mn.gov" target="_blank" style="color:#6ea8fe;">cfb.mn.gov</a><br>
                • DHS Licensing: <a href="https://licensinglookup.dhs.state.mn.us/" target="_blank" style="color:#6ea8fe;">licensinglookup.dhs.state.mn.us</a><br>
                • Transparency Portal: <a href="https://mn.gov/mmb/transparency-mn/" target="_blank" style="color:#6ea8fe;">mn.gov/mmb/transparency-mn</a>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        
        // Set overall status
        const overallStatus = mnCheckedCount >= 2 ? 'pass' : (mnCheckedCount > 0 ? 'warn' : 'fail');
        core.setStatus(this.id, overallStatus);
    }
});
