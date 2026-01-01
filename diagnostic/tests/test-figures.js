/**
 * TEST MODULE: Key Figures Validation
 * Checks for journalists, missing allegations, invalid statuses
 */

DiagnosticCore.registerTest({
    id: 'figures',
    name: 'KEY FIGURES VALIDATION',
    description: 'Validates figures have allegations, valid statuses, and no journalists',
    icon: '👤',
    critical: true,
    
    async run(core) {
        core.log('Testing key figures validation...', 'info');
        let allPassed = true;
        
        if (!core.DATA.figures?.people) {
            core.addTest(this.id, 'Figures data available', 'critical');
            core.setStatus(this.id, 'critical');
            return;
        }
        
        const people = core.DATA.figures.people;
        
        core.addTest(this.id, 'Has at least 1 figure', people.length > 0, `${people.length} figures`);
        if (people.length === 0) {
            core.setStatus(this.id, 'fail');
            return;
        }
        
        // CHECK: No journalists
        const journalists = people.filter(p => 
            core.BLOCKED_JOURNALISTS.some(j => p.name?.toLowerCase().includes(j))
        );
        core.addTest(this.id, 'No journalists in figures', journalists.length === 0,
            journalists.length > 0 ? `FOUND: ${journalists.map(j => j.name).join(', ')}` : 'Clean');
        if (journalists.length > 0) {
            allPassed = false;
            core.addIssue('critical', 'Journalist in Key Figures', 'scripts/ai-files.js',
                `${journalists.map(j => j.name).join(', ')} - Journalists REPORT on fraud, they don't commit it`,
                'Add to BLOCKED_JOURNALISTS array in ai-files.js');
        }
        
        // CHECK: All have allegations
        const noAllegations = people.filter(p => !p.allegations || p.allegations.length === 0);
        core.addTest(this.id, 'All figures have allegations', noAllegations.length === 0,
            `${people.length - noAllegations.length}/${people.length} have allegations`);
        if (noAllegations.length > 0) {
            allPassed = false;
            core.addIssue('error', 'Figures missing allegations', 'scripts/ai-files.js',
                `${noAllegations.map(p => p.name).join(', ')}`,
                'Filter out figures without allegations. Every fraud suspect must have specific charges.');
        }
        
        // CHECK: Valid statuses
        const invalidStatus = people.filter(p => !core.VALID_STATUSES.includes(p.status?.toLowerCase()));
        core.addTest(this.id, 'All figures have valid fraud status', invalidStatus.length === 0,
            `${people.length - invalidStatus.length}/${people.length} valid`);
        if (invalidStatus.length > 0) {
            core.addIssue('warning', 'Figures with invalid status', 'scripts/ai-files.js',
                `${invalidStatus.map(p => `${p.name} (${p.status})`).join(', ')}`,
                'Only allow: charged, convicted, sentenced, indicted');
        }
        
        // CHECK: No generic entries
        const generic = people.filter(p => 
            core.BLOCKED_GENERIC.some(g => p.name?.toLowerCase().includes(g))
        );
        core.addTest(this.id, 'No generic entries', generic.length === 0,
            generic.length > 0 ? `Found: ${generic.map(g => g.name).join(', ')}` : 'Clean');
        
        // TABLE: Display figures
        let tableHtml = `
            <table style="margin-top:15px;">
                <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Allegations</th><th>Issues</th></tr></thead>
                <tbody>
        `;
        
        people.forEach(p => {
            const issues = [];
            if (core.BLOCKED_JOURNALISTS.some(j => p.name?.toLowerCase().includes(j))) issues.push('JOURNALIST');
            if (!p.allegations || p.allegations.length === 0) issues.push('NO ALLEGATIONS');
            if (!core.VALID_STATUSES.includes(p.status?.toLowerCase())) issues.push('INVALID STATUS');
            if (core.BLOCKED_GENERIC.some(g => p.name?.toLowerCase().includes(g))) issues.push('GENERIC');
            
            const hasIssues = issues.length > 0;
            tableHtml += `
                <tr class="${hasIssues ? 'table-error' : ''}">
                    <td>${core.escapeHtml(p.name)}</td>
                    <td>${core.escapeHtml(p.role || 'N/A')}</td>
                    <td><span class="status status-${core.VALID_STATUSES.includes(p.status?.toLowerCase()) ? 'warn' : 'fail'}">${core.escapeHtml(p.status)}</span></td>
                    <td>${p.allegations?.length || 0} charges</td>
                    <td style="color:${hasIssues ? '#ea868f' : '#75b798'}">${hasIssues ? issues.join(', ') : 'OK'}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        core.setDetail(this.id, tableHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
