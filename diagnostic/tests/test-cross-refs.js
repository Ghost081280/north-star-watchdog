/**
 * TEST MODULE: Cross-Reference Integrity
 * Checks data consistency across all files
 */

DiagnosticCore.registerTest({
    id: 'cross-refs',
    name: 'CROSS-REFERENCE INTEGRITY',
    description: 'Checks data consistency and relationships across all files',
    icon: '🔗',
    critical: false,
    
    async run(core) {
        core.log('Testing cross-reference integrity...', 'info');
        let allPassed = true;
        
        // CHECK: Stats activeCases aligns with investigations count
        const statsCases = core.DATA.stats?.activeCases || 0;
        const invCount = core.DATA.investigations?.cases?.length || 0;
        const casesAlign = Math.abs(statsCases - invCount) <= 2;
        core.addTest(this.id, 'Stats activeCases ~ investigations count', casesAlign,
            `Stats: ${statsCases}, Actual: ${invCount}`);
        if (!casesAlign) {
            core.addIssue('warning', 'Stats and investigations mismatch', 'data/stats.json',
                `activeCases (${statsCases}) doesn't match investigations count (${invCount})`,
                'Sync activeCases with investigations.cases.length in ai-files.js');
        }
        
        // CHECK: Red flag entities exist in figures or investigations
        if (core.DATA.redflags?.flags && core.DATA.figures?.people) {
            const figureNames = core.DATA.figures.people.map(p => p.name?.toLowerCase()).filter(Boolean);
            const invNames = (core.DATA.investigations?.cases || []).map(c => c.name?.toLowerCase()).filter(Boolean);
            const allKnown = [...figureNames, ...invNames];
            
            let matchedEntities = 0;
            let totalEntities = 0;
            
            core.DATA.redflags.flags.forEach(f => {
                (f.entities || []).forEach(e => {
                    totalEntities++;
                    if (allKnown.some(k => k && e.toLowerCase().includes(k))) {
                        matchedEntities++;
                    }
                });
            });
            
            const entityMatch = totalEntities === 0 || matchedEntities > 0;
            core.addTest(this.id, 'Red flag entities relate to known figures/investigations', entityMatch,
                `${matchedEntities}/${totalEntities} match known entities`);
        }
        
        // CHECK: Learning tracks key figures
        if (core.DATA.learning?.trackedEntities && core.DATA.figures?.people) {
            const learned = core.DATA.learning.trackedEntities.map(e => e.toLowerCase());
            const figures = core.DATA.figures.people.map(p => p.name?.toLowerCase()).filter(Boolean);
            const tracked = figures.filter(f => learned.some(l => l.includes(f) || f.includes(l)));
            
            core.addTest(this.id, 'Learning system tracks key figures', tracked.length > 0 || figures.length === 0,
                `${tracked.length}/${figures.length} figures tracked`);
        }
        
        // CHECK: Trending topics relate to investigations or figures
        if (core.DATA.trending?.topics) {
            const invNames = (core.DATA.investigations?.cases || []).map(c => c.name?.toLowerCase());
            const figNames = (core.DATA.figures?.people || []).map(p => p.name?.toLowerCase());
            const allNames = [...invNames, ...figNames].filter(Boolean);
            
            const relatedTopics = core.DATA.trending.topics.filter(t => {
                const topic = (t.topic || '').toLowerCase();
                return allNames.some(n => topic.includes(n) || n.includes(topic));
            });
            
            core.addTest(this.id, 'Trending topics relate to entities', relatedTopics.length > 0 || core.DATA.trending.topics.length === 0,
                `${relatedTopics.length}/${core.DATA.trending.topics.length} related`);
        }
        
        // CHECK: News queries match learning queries
        if (core.DATA.learning?.searchQueries && core.DATA.news?.articles) {
            const learnQueries = core.DATA.learning.searchQueries;
            const newsQueries = [...new Set(core.DATA.news.articles.map(a => a.query).filter(Boolean))];
            const overlap = newsQueries.filter(q => learnQueries.some(l => l.toLowerCase().includes(q.toLowerCase())));
            
            core.addTest(this.id, 'News queries from learning system', overlap.length > 0,
                `${overlap.length} queries overlap`);
        }
        
        // CHECK: All timestamps are consistent (same day)
        const timestamps = [
            core.DATA.stats?.lastUpdated,
            core.DATA.redflags?.lastUpdated,
            core.DATA.news?.lastUpdated
        ].filter(Boolean);
        
        if (timestamps.length >= 2) {
            const dates = timestamps.map(t => new Date(t).toDateString());
            const allSameDay = dates.every(d => d === dates[0]);
            core.addTest(this.id, 'Critical files updated same day', allSameDay,
                allSameDay ? 'Timestamps aligned' : 'Different days detected');
        }
        
        // CHECK: Figure allegations match investigation types
        if (core.DATA.figures?.people && core.DATA.investigations?.cases) {
            const figAllegations = core.DATA.figures.people.flatMap(p => p.allegations || []).map(a => a.toLowerCase());
            const invTypes = core.DATA.investigations.cases.map(c => c.type?.toLowerCase()).filter(Boolean);
            
            // Just check there's some thematic overlap
            const fraudTerms = ['fraud', 'wire', 'money', 'false', 'conspiracy'];
            const hasFraudAllegations = figAllegations.some(a => fraudTerms.some(t => a.includes(t)));
            
            core.addTest(this.id, 'Figure allegations are fraud-related', hasFraudAllegations || figAllegations.length === 0,
                hasFraudAllegations ? 'Fraud allegations present' : 'Check allegation types');
        }
        
        core.setStatus(this.id, allPassed ? 'pass' : 'warn');
    }
});
