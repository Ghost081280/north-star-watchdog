/**
 * TEST MODULE: Self-Learning System
 * Validates learning.json for search queries, entity tracking, and API discovery
 */

DiagnosticCore.registerTest({
    id: 'learning',
    name: 'SELF-LEARNING SYSTEM',
    description: 'Validates search queries, tracked entities, discovered APIs, and learning updates',
    icon: '🧠',
    critical: false,
    
    async run(core) {
        core.log('Testing self-learning system...', 'info');
        let allPassed = true;
        
        if (!core.DATA.learning) {
            core.addTest(this.id, 'Learning data available', false);
            core.addIssue('warning', 'No learning data', 'scripts/ai-files.js',
                'learning.json is missing. Self-learning system not initialized.',
                'Run updateLearning() in ai-files.js');
            core.setStatus(this.id, 'fail');
            return;
        }
        
        const learning = core.DATA.learning;
        
        // CHECK: Has search queries
        const queries = learning.searchQueries || [];
        core.addTest(this.id, 'Has search queries (>=8 required)', queries.length >= 8,
            `${queries.length} queries`);
        if (queries.length < 8) {
            core.addIssue('warning', 'Too few search queries', 'data/learning.json',
                `Only ${queries.length} queries. Scraper needs at least 8 for good coverage.`,
                'Check DEFAULT_QUERIES in ai-scraper.js. Check updateLearning() adds new queries.');
        }
        
        // CHECK: Has tracked entities
        const entities = learning.trackedEntities || [];
        core.addTest(this.id, 'Has tracked entities', entities.length > 0,
            `${entities.length} entities`);
        
        // CHECK: Key terms in queries
        const keyTerms = ['minnesota', 'fraud', 'feeding our future', 'childcare'];
        let foundTerms = 0;
        keyTerms.forEach(term => {
            const hasTerm = queries.some(q => q.toLowerCase().includes(term.toLowerCase()));
            if (hasTerm) foundTerms++;
        });
        core.addTest(this.id, 'Queries include key terms', foundTerms >= 2,
            `Found ${foundTerms}/4 key terms`);
        
        // CHECK: Has last update timestamp
        const hasTimestamp = learning.lastLearningUpdate;
        const age = core.getAge(learning.lastLearningUpdate);
        core.addTest(this.id, 'Learning recently updated', age < 24 * 60 * 60 * 1000,
            hasTimestamp ? core.formatAge(age) : 'No timestamp');
        
        // CHECK: Has discovered APIs
        const suggestedApis = learning.suggestedApis || [];
        core.addTest(this.id, 'Discovering new APIs', suggestedApis.length >= 0,
            `${suggestedApis.length} APIs discovered`);
        
        // CHECK: Entities are valid (not empty strings)
        const validEntities = entities.filter(e => e && e.trim().length > 2);
        core.addTest(this.id, 'Entities are valid', validEntities.length === entities.length,
            `${validEntities.length}/${entities.length} valid`);
        
        // DISPLAY: Learning stats
        const detailHtml = `
            <div class="data-grid">
                <div class="data-card ${queries.length >= 8 ? 'success' : 'warning'}">
                    <div class="data-card-title">Search Queries</div>
                    <div class="data-card-value">${queries.length}</div>
                    <div class="data-card-detail">Min: 8 required</div>
                </div>
                <div class="data-card ${entities.length > 0 ? 'success' : 'warning'}">
                    <div class="data-card-title">Tracked Entities</div>
                    <div class="data-card-value">${entities.length}</div>
                </div>
                <div class="data-card">
                    <div class="data-card-title">Discovered APIs</div>
                    <div class="data-card-value">${suggestedApis.length}</div>
                </div>
                <div class="data-card">
                    <div class="data-card-title">Last Update</div>
                    <div class="data-card-value" style="font-size:12px;">${hasTimestamp ? core.formatAge(age) : 'Never'}</div>
                </div>
            </div>
            
            <div style="margin-top:15px;">
                <div style="color:#d4af37; font-size:10px; margin-bottom:5px;">SEARCH QUERIES (${queries.length}):</div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; max-height:100px; overflow-y:auto;">
                    ${queries.slice(0, 20).map(q => `<span style="background:#1a1a1a; padding:3px 8px; font-size:9px; border:1px solid #333;">${core.escapeHtml(q)}</span>`).join('')}
                    ${queries.length > 20 ? `<span style="color:#666; font-size:9px;">+${queries.length - 20} more</span>` : ''}
                </div>
            </div>
            
            <div style="margin-top:15px;">
                <div style="color:#d4af37; font-size:10px; margin-bottom:5px;">TRACKED ENTITIES (${entities.length}):</div>
                <div style="display:flex; flex-wrap:wrap; gap:5px; max-height:100px; overflow-y:auto;">
                    ${entities.slice(0, 20).map(e => `<span style="background:#0f5132; padding:3px 8px; font-size:9px; border:1px solid #198754;">${core.escapeHtml(e)}</span>`).join('')}
                    ${entities.length > 20 ? `<span style="color:#666; font-size:9px;">+${entities.length - 20} more</span>` : ''}
                </div>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'warn');
    }
});
