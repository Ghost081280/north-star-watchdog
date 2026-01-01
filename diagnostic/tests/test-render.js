/**
 * TEST MODULE: Render Simulation
 * Simulates frontend rendering to catch display issues
 */

DiagnosticCore.registerTest({
    id: 'render',
    name: 'RENDER SIMULATION',
    description: 'Simulates what the frontend would display and catches rendering issues',
    icon: '🖥️',
    critical: false,
    
    async run(core) {
        core.log('Simulating frontend rendering...', 'info');
        let allPassed = true;
        let renderIssues = [];
        
        // CHECK: Stats would render (not $0 or 0)
        const statsOk = core.DATA.stats && 
            core.DATA.stats.charged > 0 && 
            core.DATA.stats.alleged !== '$0' &&
            core.DATA.stats.alleged;
        core.addTest(this.id, 'Stats section would render correctly', statsOk,
            statsOk ? 'Values present' : 'Would show $0 or empty');
        if (!statsOk) {
            renderIssues.push('Stats section would display zeros or empty');
        }
        
        // CHECK: Briefing would render
        const briefingOk = core.DATA.stats?.briefing && core.DATA.stats.briefing.length > 50;
        core.addTest(this.id, 'Briefing would render', briefingOk,
            briefingOk ? 'Content present' : 'Empty or too short');
        if (!briefingOk) {
            renderIssues.push('Briefing section would be empty or placeholder');
        }
        
        // CHECK: Investigations would render (with source URLs)
        const invWithSource = (core.DATA.investigations?.cases || []).filter(c => c.sourceUrl?.startsWith('http'));
        const invOk = invWithSource.length > 0;
        core.addTest(this.id, 'Investigations would render', invOk,
            invOk ? `${invWithSource.length} valid` : 'None have source URLs');
        if (!invOk) {
            allPassed = false;
            renderIssues.push('Active Investigations would show empty or 404 links');
        }
        
        // CHECK: Key figures would render (with allegations)
        const validFigures = (core.DATA.figures?.people || []).filter(p => 
            p.allegations?.length > 0 && core.VALID_STATUSES.includes(p.status?.toLowerCase())
        );
        const figuresOk = validFigures.length > 0;
        core.addTest(this.id, 'Key Figures would render', figuresOk,
            figuresOk ? `${validFigures.length} valid` : 'None have valid allegations');
        if (!figuresOk) {
            renderIssues.push('Key Figures section would be empty');
        }
        
        // CHECK: Trending would render (not empty)
        const trendingOk = core.DATA.trending?.topics?.length > 0;
        core.addTest(this.id, 'Trending section would render', trendingOk,
            trendingOk ? `${core.DATA.trending.topics.length} topics` : 'Would show "Loading..."');
        if (!trendingOk) {
            renderIssues.push('Trending Now would show "Loading..." forever');
        }
        
        // CHECK: Story ideas would render (not empty)
        const ideasOk = core.DATA.storyideas?.ideas?.length > 0;
        core.addTest(this.id, 'Story Ideas would render', ideasOk,
            ideasOk ? `${core.DATA.storyideas.ideas.length} ideas` : 'Would show "Loading..."');
        if (!ideasOk) {
            renderIssues.push('Investigate This would show "Loading..." forever');
        }
        
        // CHECK: AI Detective would render
        const detectiveOk = core.DATA.redflags?.flags?.length > 0;
        core.addTest(this.id, 'AI Detective would render', detectiveOk,
            detectiveOk ? `${core.DATA.redflags.flags.length} cards` : 'Would show placeholder');
        if (!detectiveOk) {
            renderIssues.push('AI Detective would show placeholder message');
        }
        
        // CHECK: News would render
        const newsOk = core.DATA.news?.articles?.length > 0;
        core.addTest(this.id, 'News section would render', newsOk,
            newsOk ? `${core.DATA.news.articles.length} articles` : 'Would be empty');
        if (!newsOk) {
            allPassed = false;
            renderIssues.push('Latest News would be empty');
        }
        
        // CHECK: Quick searches would have content
        const hasQuickSearches = core.DATA.trending?.topics?.some(t => t.suggestedSearches?.length > 0);
        core.addTest(this.id, 'Quick searches would populate', hasQuickSearches,
            hasQuickSearches ? 'Have search terms' : 'Would be empty');
        
        // CHECK: View Source buttons would work
        const brokenSources = (core.DATA.investigations?.cases || []).filter(c => !c.sourceUrl?.startsWith('http'));
        core.addTest(this.id, 'View Source buttons would work', brokenSources.length === 0,
            brokenSources.length === 0 ? 'All have valid URLs' : `${brokenSources.length} would 404`);
        if (brokenSources.length > 0) {
            allPassed = false;
            renderIssues.push(`${brokenSources.length} View Source buttons would lead to 404s`);
            core.addIssue('error', 'View Source buttons broken', 'data/investigations.json',
                `${brokenSources.map(c => c.name).join(', ')} have invalid/missing sourceUrl`,
                'Filter investigations without valid http sourceUrl in ai-files.js');
        }
        
        // DISPLAY: Render summary
        let detailHtml = `
            <div class="data-grid">
                <div class="data-card ${statsOk ? 'success' : 'error'}"><div class="data-card-title">Stats</div><div class="data-card-value">${statsOk ? 'OK' : 'FAIL'}</div></div>
                <div class="data-card ${briefingOk ? 'success' : 'error'}"><div class="data-card-title">Briefing</div><div class="data-card-value">${briefingOk ? 'OK' : 'FAIL'}</div></div>
                <div class="data-card ${invOk ? 'success' : 'error'}"><div class="data-card-title">Investigations</div><div class="data-card-value">${invOk ? 'OK' : 'FAIL'}</div></div>
                <div class="data-card ${figuresOk ? 'success' : 'warning'}"><div class="data-card-title">Figures</div><div class="data-card-value">${figuresOk ? 'OK' : 'EMPTY'}</div></div>
                <div class="data-card ${trendingOk ? 'success' : 'error'}"><div class="data-card-title">Trending</div><div class="data-card-value">${trendingOk ? 'OK' : 'FAIL'}</div></div>
                <div class="data-card ${ideasOk ? 'success' : 'error'}"><div class="data-card-title">Ideas</div><div class="data-card-value">${ideasOk ? 'OK' : 'FAIL'}</div></div>
                <div class="data-card ${detectiveOk ? 'success' : 'error'}"><div class="data-card-title">Detective</div><div class="data-card-value">${detectiveOk ? 'OK' : 'FAIL'}</div></div>
                <div class="data-card ${newsOk ? 'success' : 'error'}"><div class="data-card-title">News</div><div class="data-card-value">${newsOk ? 'OK' : 'FAIL'}</div></div>
            </div>
        `;
        
        if (renderIssues.length > 0) {
            detailHtml += `
                <div style="margin-top:15px; padding:15px; background:#1a0a0a; border-left:3px solid #dc3545;">
                    <div style="color:#ea868f; font-size:11px; margin-bottom:10px;">RENDER ISSUES:</div>
                    <ul style="color:#ccc; font-size:11px; margin-left:15px;">
                        ${renderIssues.map(i => `<li>${i}</li>`).join('')}
                    </ul>
                </div>
            `;
        }
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
