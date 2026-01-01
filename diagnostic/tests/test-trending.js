/**
 * TEST MODULE: Trending Topics
 * Validates trending topics have descriptions, heat scores, and search terms
 */

DiagnosticCore.registerTest({
    id: 'trending',
    name: 'TRENDING TOPICS',
    description: 'Validates trending topics have descriptions, reasons, and suggested searches',
    icon: '📈',
    critical: false,
    
    async run(core) {
        core.log('Testing trending topics...', 'info');
        let allPassed = true;
        
        if (!core.DATA.trending?.topics) {
            core.addTest(this.id, 'Trending data available', false);
            core.setStatus(this.id, 'fail');
            return;
        }
        
        const topics = core.DATA.trending.topics;
        
        // CHECK: Not empty
        core.addTest(this.id, 'Trending topics not empty', topics.length > 0,
            topics.length > 0 ? `${topics.length} topics` : 'EMPTY ARRAY');
        if (topics.length === 0) {
            allPassed = false;
            core.addIssue('error', 'Trending topics empty', 'scripts/ai-files.js',
                'Topics array is empty. Frontend shows "Loading..."',
                'Check preservation logic: only update if newTopics.length > 0');
            core.setStatus(this.id, 'fail');
            return;
        }
        
        // CHECK: All have topic names
        const noName = topics.filter(t => !t.topic);
        core.addTest(this.id, 'All topics have names', noName.length === 0,
            `${topics.length - noName.length}/${topics.length} have names`);
        
        // CHECK: All have descriptions
        const noDesc = topics.filter(t => !t.description || t.description.length < 10);
        core.addTest(this.id, 'All topics have descriptions', noDesc.length === 0,
            `${topics.length - noDesc.length}/${topics.length} have descriptions`);
        if (noDesc.length > 0) {
            allPassed = false;
            core.addIssue('warning', 'Trending topics missing descriptions', 'scripts/ai-analyzer.js',
                `${noDesc.length} topics have no/short description`,
                'Update GROQ prompt to require description field for trending');
        }
        
        // CHECK: All have reason (short summary)
        const noReason = topics.filter(t => !t.reason);
        core.addTest(this.id, 'All topics have reason', noReason.length === 0,
            `${topics.length - noReason.length}/${topics.length} have reason`);
        
        // CHECK: All have heat scores
        const noHeat = topics.filter(t => typeof t.heat !== 'number');
        core.addTest(this.id, 'All topics have heat scores', noHeat.length === 0,
            `${topics.length - noHeat.length}/${topics.length} have heat`);
        
        // CHECK: All have suggested searches
        const noSearches = topics.filter(t => !t.suggestedSearches || t.suggestedSearches.length === 0);
        core.addTest(this.id, 'All topics have suggested searches', noSearches.length === 0,
            `${topics.length - noSearches.length}/${topics.length} have searches`);
        
        // TABLE: Display topics
        let tableHtml = `
            <table style="margin-top:15px;">
                <thead><tr><th>Topic</th><th>Heat</th><th>Description</th><th>Searches</th><th>Issues</th></tr></thead>
                <tbody>
        `;
        
        topics.forEach(t => {
            const issues = [];
            if (!t.topic) issues.push('NO NAME');
            if (!t.description || t.description.length < 10) issues.push('NO DESC');
            if (typeof t.heat !== 'number') issues.push('NO HEAT');
            if (!t.suggestedSearches || t.suggestedSearches.length === 0) issues.push('NO SEARCHES');
            
            const hasIssues = issues.length > 0;
            
            tableHtml += `
                <tr class="${hasIssues ? 'table-error' : ''}">
                    <td>${core.escapeHtml(t.topic || 'N/A')}</td>
                    <td>${t.heat || 'N/A'}</td>
                    <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${core.escapeHtml((t.description || '').substring(0, 50))}...</td>
                    <td>${t.suggestedSearches?.length || 0}</td>
                    <td style="color:${hasIssues ? '#ea868f' : '#75b798'}">${hasIssues ? issues.join(', ') : 'OK'}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        core.setDetail(this.id, tableHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'warn');
    }
});
