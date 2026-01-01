/**
 * TEST MODULE: Red Flags / AI Detective
 * Validates confidence scores, entities, insights, and per-flag source tracking
 */

DiagnosticCore.registerTest({
    id: 'red-flags',
    name: 'RED FLAGS / AI DETECTIVE',
    description: 'Validates red flags have confidence, entities, insights, and proper source attribution',
    icon: '🚩',
    critical: true,
    
    async run(core) {
        core.log('Testing red flags / AI Detective...', 'info');
        let allPassed = true;
        
        if (!core.DATA.redflags?.flags) {
            core.addTest(this.id, 'Red flags data available', 'critical');
            core.setStatus(this.id, 'critical');
            return;
        }
        
        const flags = core.DATA.redflags.flags;
        
        core.addTest(this.id, 'Has at least 1 red flag', flags.length > 0, `${flags.length} flags`);
        if (flags.length === 0) {
            core.setStatus(this.id, 'warn');
            return;
        }
        
        // CHECK: All have confidence scores
        const noConfidence = flags.filter(f => typeof f.confidence !== 'number');
        core.addTest(this.id, 'All flags have confidence scores', noConfidence.length === 0,
            `${flags.length - noConfidence.length}/${flags.length} have confidence`);
        
        // CHECK: All have entities
        const noEntities = flags.filter(f => !f.entities || f.entities.length === 0);
        core.addTest(this.id, 'All flags have entities', noEntities.length === 0,
            `${flags.length - noEntities.length}/${flags.length} have entities`);
        
        // CHECK: All have insights (AI detective analysis)
        const noInsight = flags.filter(f => !f.insight || f.insight.length < 20);
        core.addTest(this.id, 'All flags have AI insights', noInsight.length === 0,
            `${flags.length - noInsight.length}/${flags.length} have insights`);
        if (noInsight.length > 0) {
            core.addIssue('warning', 'Red flags missing AI insights', 'scripts/ai-analyzer.js',
                `${noInsight.length} flags have no detective insight`,
                'Ensure GROQ prompt requires insight field. Check parseAIJson extracts it.');
        }
        
        // CHECK: All have apisUsed
        const noApis = flags.filter(f => !f.apisUsed || f.apisUsed.length === 0);
        core.addTest(this.id, 'All flags have apisUsed', noApis.length === 0,
            `${flags.length - noApis.length}/${flags.length} have apisUsed`);
        if (noApis.length > 0) {
            allPassed = false;
            core.addIssue('error', 'Red flags missing apisUsed', 'scripts/ai-files.js',
                `${noApis.length} flags have no source attribution`,
                'Ensure getSourcesForRedFlag() is called in ai-files.js');
        }
        
        // CHECK: Priority distribution
        const highPriority = flags.filter(f => f.priority === 'high' || f.confidence >= 85);
        const medPriority = flags.filter(f => f.priority === 'medium' || (f.confidence >= 65 && f.confidence < 85));
        core.addTest(this.id, 'Has high-priority flags', highPriority.length > 0,
            `${highPriority.length} high priority`);
        
        // CHECK: Types are valid
        const validTypes = ['federal_freeze', 'program_termination', 'shell_company', 'closed_facility', 
            'federal_charges', 'nonprofit_red_flag', 'congressional_oversight', 'payment_irregularity'];
        const unknownTypes = flags.filter(f => f.type && !validTypes.some(t => f.type.toLowerCase().includes(t.replace(/_/g, ''))));
        core.addTest(this.id, 'Flag types are recognized', unknownTypes.length < flags.length / 2,
            `${flags.length - unknownTypes.length}/${flags.length} recognized types`);
        
        // TABLE: Display flags
        let tableHtml = `
            <table style="margin-top:15px;">
                <thead><tr><th>Type</th><th>Confidence</th><th>Entities</th><th>APIs</th><th>Insight</th><th>Issues</th></tr></thead>
                <tbody>
        `;
        
        flags.forEach(f => {
            const issues = [];
            if (typeof f.confidence !== 'number') issues.push('NO CONFIDENCE');
            if (!f.entities || f.entities.length === 0) issues.push('NO ENTITIES');
            if (!f.insight || f.insight.length < 20) issues.push('NO INSIGHT');
            if (!f.apisUsed || f.apisUsed.length === 0) issues.push('NO APIS');
            if (f.apisUsed?.length === 6) issues.push('BLANKET SOURCES');
            
            const hasIssues = issues.length > 0;
            const confColor = f.confidence >= 85 ? '#75b798' : (f.confidence >= 65 ? '#ffda6a' : '#ea868f');
            
            tableHtml += `
                <tr class="${hasIssues ? 'table-error' : ''}">
                    <td>${core.escapeHtml(f.type || 'unknown')}</td>
                    <td style="color:${confColor}">${f.confidence || 'N/A'}%</td>
                    <td>${f.entities?.length || 0}</td>
                    <td style="color:${f.apisUsed?.length > 1 ? '#75b798' : '#ffda6a'}">${f.apisUsed?.length || 0} sources</td>
                    <td>${f.insight ? 'Yes' : 'No'}</td>
                    <td style="color:${hasIssues ? '#ea868f' : '#75b798'}">${hasIssues ? issues.join(', ') : 'OK'}</td>
                </tr>
            `;
        });
        
        tableHtml += '</tbody></table>';
        core.setDetail(this.id, tableHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
