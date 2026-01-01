/**
 * TEST MODULE: Stats Validation
 * Compares stats against verified baseline from official sources
 */

DiagnosticCore.registerTest({
    id: 'stats',
    name: 'STATS VALIDATION & BASELINE CHECK',
    description: 'Verifies stats meet verified baseline and have proper source citations',
    icon: '📊',
    critical: true,
    
    async run(core) {
        core.log('Testing stats validation...', 'info');
        let allPassed = true;
        
        if (!core.DATA.stats) {
            core.addTest(this.id, 'Stats data available', 'critical');
            core.setStatus(this.id, 'critical');
            return;
        }
        
        const stats = core.DATA.stats;
        const baseline = core.VERIFIED_BASELINE;
        
        // ============================================
        // CHECK 1: Charged meets baseline
        // ============================================
        const chargedOk = typeof stats.charged === 'number' && stats.charged >= baseline.charged;
        core.addTest(this.id, `Charged >= baseline (${baseline.charged})`, chargedOk,
            `Current: ${stats.charged}, Baseline: ${baseline.charged}`);
        if (!chargedOk) {
            allPassed = false;
            core.addIssue('error', 'Charged below baseline', 'data/stats.json',
                `Current: ${stats.charged}, Should be >= ${baseline.charged}`,
                'Stats can only go UP. Check ai-files.js Math.max() logic.');
        }
        
        // ============================================
        // CHECK 2: Convicted meets baseline
        // ============================================
        const convictedOk = typeof stats.convicted === 'number' && stats.convicted >= baseline.convicted;
        core.addTest(this.id, `Convicted >= baseline (${baseline.convicted})`, convictedOk,
            `Current: ${stats.convicted}, Baseline: ${baseline.convicted}`);
        if (!convictedOk) allPassed = false;
        
        // ============================================
        // CHECK 3: Alleged amount
        // ============================================
        const allegedOk = stats.alleged && stats.alleged.includes('9') && stats.alleged.toUpperCase().includes('B');
        core.addTest(this.id, 'Alleged matches $9B+ baseline', allegedOk,
            `Current: ${stats.alleged}, Baseline: ${baseline.alleged}`);
        if (!allegedOk) {
            allPassed = false;
            core.addIssue('critical', 'Alleged amount below verified baseline', 'scripts/ai-files.js',
                `Current: ${stats.alleged}, Verified: $9B+ (U.S. Attorney Joe Thompson, Dec 2025)`,
                'Never allow alleged to go below $9B+. This is the verified federal estimate.');
        }
        
        // ============================================
        // CHECK 4: Active cases
        // ============================================
        const casesOk = typeof stats.activeCases === 'number' && stats.activeCases >= baseline.activeCases;
        core.addTest(this.id, `Active cases >= baseline (${baseline.activeCases})`, casesOk,
            `Current: ${stats.activeCases}, Baseline: ${baseline.activeCases}`);
        
        // ============================================
        // CHECK 5: Logical consistency
        // ============================================
        const logicalOk = stats.convicted <= stats.charged;
        core.addTest(this.id, 'Logic: convicted <= charged', logicalOk,
            `${stats.convicted} convicted, ${stats.charged} charged`);
        if (!logicalOk) {
            core.addIssue('error', 'Stats logic error', 'data/stats.json',
                'Convicted count exceeds charged count - logically impossible',
                'Check ai-analyzer.js stats extraction. May be parsing error.');
        }
        
        // ============================================
        // CHECK 6: Source verification
        // ============================================
        const hasSource = stats.source && stats.source.length > 10;
        core.addTest(this.id, 'Has verified source citation', hasSource,
            stats.source || 'MISSING');
        
        const hasSourceUrl = stats.sourceUrl && stats.sourceUrl.startsWith('http');
        core.addTest(this.id, 'Has source URL for verification', hasSourceUrl,
            hasSourceUrl ? 'Present' : 'MISSING');
        
        // ============================================
        // DISPLAY: Comparison table
        // ============================================
        const detailHtml = `
            <table style="margin-top:15px;">
                <thead>
                    <tr><th>Metric</th><th>Current</th><th>Baseline</th><th>Status</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Charged</td>
                        <td>${stats.charged}</td>
                        <td>>= ${baseline.charged}</td>
                        <td style="color:${chargedOk ? '#75b798' : '#ea868f'}">${chargedOk ? 'PASS' : 'FAIL'}</td>
                    </tr>
                    <tr>
                        <td>Convicted</td>
                        <td>${stats.convicted}</td>
                        <td>>= ${baseline.convicted}</td>
                        <td style="color:${convictedOk ? '#75b798' : '#ea868f'}">${convictedOk ? 'PASS' : 'FAIL'}</td>
                    </tr>
                    <tr>
                        <td>Alleged</td>
                        <td>${stats.alleged}</td>
                        <td>${baseline.alleged}</td>
                        <td style="color:${allegedOk ? '#75b798' : '#ea868f'}">${allegedOk ? 'PASS' : 'FAIL'}</td>
                    </tr>
                    <tr>
                        <td>Active Cases</td>
                        <td>${stats.activeCases}</td>
                        <td>>= ${baseline.activeCases}</td>
                        <td style="color:${casesOk ? '#75b798' : '#ea868f'}">${casesOk ? 'PASS' : 'FAIL'}</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top:10px; font-size:10px; color:#666;">
                <strong>Baseline Source:</strong> ${baseline.source}<br>
                <strong>URL:</strong> <a href="${baseline.sourceUrl}" target="_blank" style="color:#6ea8fe;">${baseline.sourceUrl}</a>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
