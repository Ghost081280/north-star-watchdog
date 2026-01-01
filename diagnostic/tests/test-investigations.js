/**
 * TEST MODULE: Investigations Validation
 * Verifies source URLs, descriptions, and search terms
 */

DiagnosticCore.registerTest({
    id: 'investigations',
    name: 'INVESTIGATIONS VALIDATION',
    description: 'Verifies all investigations have source URLs, descriptions, and search terms',
    icon: '🔍',
    critical: true,
    
    async run(core) {
        core.log('Testing investigations validation...', 'info');
        let allPassed = true;
        
        if (!core.DATA.investigations?.cases) {
            core.addTest(this.id, 'Investigations data available', 'critical');
            core.setStatus(this.id, 'critical');
            return;
        }
        
        const cases = core.DATA.investigations.cases;
        
        core.addTest(this.id, 'Has at least 1 investigation', cases.length > 0, `${cases.length} cases`);
        if (cases.length === 0) {
            core.setStatus(this.id, 'warn');
            return;
        }
        
        // CHECK: All have source URLs
        const noSource = cases.filter(c => !c.sourceUrl || !c.sourceUrl.startsWith('http'));
        core.addTest(this.id, 'All investigations have source URLs', noSource.length === 0,
            `${cases.length - noSource.length}/${cases.length} have URLs`);
        if (noSource.length > 0) {
            allPassed = false;
            core.addIssue('error', 'Investigations missing source URLs', 'scripts/ai-files.js',
                `${noSource.map(c => c.name).join(', ')}`,
                'Filter investigations without valid sourceUrl starting with http');
        }
        
        // CHECK: All have descriptions
        const noDesc = cases.filter(c => !c.description || c.description.length < 20);
        core.addTest(this.id, 'All investigations have descriptions', noDesc.length === 0,
            `${cases.length - noDesc.length}/${cases.length} have descriptions`);
        
        // CHECK: All have search terms
        const noSearches = cases.filter(c => !c.searches || c.searches.length === 0);
        core.addTest(this.id, 'All investigations have search terms', noSearches.length === 0,
            `${cases.length - noSearches.length}/${cases.length} have searches`);
        if (noSearches.length > 0) {
            core.addIssue('warning', 'Investigations missing search terms', 'scripts/ai-analyzer.js',
                `${noSearches.map(c => c.name).join(', ')}`,
                'Update GROQ prompt to require searches array for investigations');
        }
        
        // CHECK: All have amounts
        const noAmount = cases.filter(c => !c.amount);
        core.addTest(this.id, 'All investigations have amounts', noAmount.length === 0,
            `${cases.length - noAmount.length}/${cases.length} have amounts`);
        
        // TABLE: Display investigations
        let tableHtml = `
            <table style="margin-top:15px;">
                <thead><tr><th>Name</th><th>Amount</th><th>Status</th><th>Source URL</th><th>Searches</th><th>Issues</th></tr></thead>
                <tbody>
        `;
        
        cases.forEach(c => {
            const issues = [];
            if (!c.sourceUrl || !c.sourceUrl.startsWith('http')) issues.push('NO URL');
            if (!c.description || c.description.length < 20) issues.push('NO DESC');
            if (!c.searches || c.searches.length === 0) issues.push('NO SEARCHES');
            if (!c.amount) issues.push('NO AMOUNT');
            
            const hasIssues = issues.length > 0;
            const urlStatus = c.sourceUrl?.startsWith('http') ? 'Present' : 'MISSING';
            
            tableHtml += `
                <tr class="${hasIssues ? 'table-error' : ''}">
                    <td>${core.escapeHtml(c.name)}</td>
                    <td>${core.escapeHtml(c.amount || 'N/A')}</td>
                    <td>${core.escapeHtml(c.status || 'N/A')}</td>
                    <td style="color:${c.sourceUrl?.startsWith('http') ? '#75b798' : '#ea868f'}">${urlStatus}</td>
                    <td>${c.searches?.length || 0} terms</td>
                    <td style="color:${hasIssues ? '#ea868f' : '#75b798'}">${hasIssues ? issues.join(', ') : 'OK'}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        core.setDetail(this.id, tableHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
