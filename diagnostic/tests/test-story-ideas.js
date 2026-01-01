/**
 * TEST MODULE: Story Ideas (Investigate This)
 * Validates story ideas have AI insights, search terms, and required fields
 */

DiagnosticCore.registerTest({
    id: 'story-ideas',
    name: 'STORY IDEAS (INVESTIGATE THIS)',
    description: 'Validates story ideas have AI insights, search terms, questions, and angles',
    icon: '💡',
    critical: false,
    
    async run(core) {
        core.log('Testing story ideas...', 'info');
        let allPassed = true;
        
        if (!core.DATA.storyideas?.ideas) {
            core.addTest(this.id, 'Story ideas data available', false);
            core.setStatus(this.id, 'fail');
            return;
        }
        
        const ideas = core.DATA.storyideas.ideas;
        
        // CHECK: Not empty
        core.addTest(this.id, 'Story ideas not empty', ideas.length > 0,
            ideas.length > 0 ? `${ideas.length} ideas` : 'EMPTY ARRAY');
        if (ideas.length === 0) {
            allPassed = false;
            core.addIssue('error', 'Story ideas empty', 'scripts/ai-files.js',
                'Ideas array is empty. Frontend shows "Loading..."',
                'Check preservation logic: only update if newIdeas.length > 0');
            core.setStatus(this.id, 'fail');
            return;
        }
        
        // CHECK: All have titles
        const noTitle = ideas.filter(i => !i.title);
        core.addTest(this.id, 'All ideas have titles', noTitle.length === 0,
            `${ideas.length - noTitle.length}/${ideas.length} have titles`);
        
        // CHECK: All have angles
        const noAngle = ideas.filter(i => !i.angle || i.angle.length < 10);
        core.addTest(this.id, 'All ideas have investigative angles', noAngle.length === 0,
            `${ideas.length - noAngle.length}/${ideas.length} have angles`);
        
        // CHECK: All have descriptions
        const noDesc = ideas.filter(i => !i.description || i.description.length < 10);
        core.addTest(this.id, 'All ideas have descriptions', noDesc.length === 0,
            `${ideas.length - noDesc.length}/${ideas.length} have descriptions`);
        
        // CHECK: All have AI insights (for purple box)
        const noInsight = ideas.filter(i => !i.insight || i.insight.length < 10);
        core.addTest(this.id, 'All ideas have AI insights', noInsight.length === 0,
            `${ideas.length - noInsight.length}/${ideas.length} have insights`);
        if (noInsight.length > 0) {
            allPassed = false;
            core.addIssue('warning', 'Story ideas missing AI insights', 'scripts/ai-analyzer.js',
                `${noInsight.length} ideas have no insight field for the purple AI box`,
                'Update GROQ prompt to require insight field for storyIdeas');
        }
        
        // CHECK: All have search terms
        const noSearches = ideas.filter(i => !i.searches || i.searches.length === 0);
        core.addTest(this.id, 'All ideas have search terms', noSearches.length === 0,
            `${ideas.length - noSearches.length}/${ideas.length} have searches`);
        if (noSearches.length > 0) {
            allPassed = false;
            core.addIssue('warning', 'Story ideas missing search terms', 'scripts/ai-analyzer.js',
                `${noSearches.length} ideas have no searches array for research buttons`,
                'Update GROQ prompt to require searches field for storyIdeas');
        }
        
        // CHECK: All have questions
        const noQuestions = ideas.filter(i => !i.questions || i.questions.length === 0);
        core.addTest(this.id, 'All ideas have investigation questions', noQuestions.length === 0,
            `${ideas.length - noQuestions.length}/${ideas.length} have questions`);
        
        // CHECK: All have badges
        const noBadge = ideas.filter(i => !i.badge);
        core.addTest(this.id, 'All ideas have badges', noBadge.length === 0,
            `${ideas.length - noBadge.length}/${ideas.length} have badges`);
        
        // TABLE: Display ideas
        let tableHtml = `
            <table style="margin-top:15px;">
                <thead><tr><th>Title</th><th>Badge</th><th>Angle</th><th>Insight</th><th>Searches</th><th>Issues</th></tr></thead>
                <tbody>
        `;
        
        ideas.forEach(i => {
            const issues = [];
            if (!i.title) issues.push('NO TITLE');
            if (!i.angle || i.angle.length < 10) issues.push('NO ANGLE');
            if (!i.insight || i.insight.length < 10) issues.push('NO INSIGHT');
            if (!i.searches || i.searches.length === 0) issues.push('NO SEARCHES');
            if (!i.questions || i.questions.length === 0) issues.push('NO QUESTIONS');
            
            const hasIssues = issues.length > 0;
            
            tableHtml += `
                <tr class="${hasIssues ? 'table-error' : ''}">
                    <td>${core.escapeHtml((i.title || 'N/A').substring(0, 30))}...</td>
                    <td>${core.escapeHtml(i.badge || 'N/A')}</td>
                    <td>${i.angle ? 'Yes' : 'No'}</td>
                    <td>${i.insight ? 'Yes' : 'No'}</td>
                    <td>${i.searches?.length || 0}</td>
                    <td style="color:${hasIssues ? '#ea868f' : '#75b798'}">${hasIssues ? issues.join(', ') : 'OK'}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        core.setDetail(this.id, tableHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'warn');
    }
});
