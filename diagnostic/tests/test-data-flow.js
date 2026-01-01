/**
 * TEST MODULE: Backend-Frontend Data Flow
 * Verifies data flows correctly from backend scripts to frontend display
 */

DiagnosticCore.registerTest({
    id: 'data-flow',
    name: 'BACKEND-FRONTEND DATA FLOW',
    description: 'Verifies data pipeline from scraper → analyzer → files → frontend',
    icon: '🔄',
    critical: true,
    
    async run(core) {
        core.log('Testing backend-frontend data flow...', 'info');
        let allPassed = true;
        
        // ============================================
        // CHECK 1: News articles scraped
        // ============================================
        const hasArticles = core.DATA.news?.articles?.length > 0;
        core.addTest(this.id, 'News scraper producing articles', hasArticles,
            hasArticles ? `${core.DATA.news.articles.length} articles` : 'NO ARTICLES - scraper may be failing');
        
        if (!hasArticles) {
            allPassed = false;
            core.addIssue('critical', 'No news articles', 'scripts/ai-scraper.js',
                'Google News scraper returned no articles. The entire pipeline depends on this.',
                'Check scrapeGoogleNews(). Verify Google News RSS is accessible. Check network/CORS issues.');
        }
        
        // ============================================
        // CHECK 2: AI analyzer producing output
        // ============================================
        const hasRedFlags = core.DATA.redflags?.flags?.length > 0;
        core.addTest(this.id, 'AI analyzer producing red flags', hasRedFlags,
            hasRedFlags ? `${core.DATA.redflags.flags.length} flags` : 'No red flags - AI may not be analyzing');
        
        if (!hasRedFlags && hasArticles) {
            core.addIssue('error', 'No red flags generated', 'scripts/ai-analyzer.js',
                'Articles exist but no red flags were generated',
                'Check GROQ_API_KEY. Check analyzeWithGroq() response parsing.');
        }
        
        // ============================================
        // CHECK 3: Briefing synthesis (not placeholder)
        // ============================================
        if (core.DATA.stats?.briefing) {
            const briefing = core.DATA.stats.briefing;
            const placeholders = ['unavailable', 'loading', 'standing by', 'no data'];
            const isPlaceholder = placeholders.some(p => briefing.toLowerCase().includes(p)) || briefing.length < 50;
            
            core.addTest(this.id, 'AI briefing synthesized (not placeholder)', !isPlaceholder,
                isPlaceholder ? 'Placeholder text detected' : `${briefing.length} chars`);
            
            if (isPlaceholder) {
                allPassed = false;
                core.addIssue('error', 'Briefing is placeholder', 'scripts/ai-analyzer.js',
                    'Backend not generating proper briefings. Users see generic placeholder.',
                    'Check GROQ API response. Check briefing field in prompt. Check preservation logic in ai-files.js.');
            }
            
            // Check briefing comprehensiveness
            const hasMultipleSentences = briefing.split(/[.!?]+/).filter(s => s.trim().length > 10).length >= 3;
            core.addTest(this.id, 'Briefing is comprehensive (3+ sentences)', hasMultipleSentences,
                hasMultipleSentences ? 'Good synthesis' : 'Too short - may be just echoing headline');
        }
        
        // ============================================
        // CHECK 4: Red flags have insights
        // ============================================
        if (core.DATA.redflags?.flags?.length > 0) {
            const withInsights = core.DATA.redflags.flags.filter(f => f.insight && f.insight.length > 20);
            const hasInsights = withInsights.length > 0;
            
            core.addTest(this.id, 'Red flags have AI-generated insights', hasInsights,
                `${withInsights.length}/${core.DATA.redflags.flags.length} have insights`);
            
            if (!hasInsights) {
                core.addIssue('warning', 'Red flags missing AI insights', 'scripts/ai-analyzer.js',
                    'Detective insights not being generated. Cards will look incomplete.',
                    'Ensure GROQ prompt includes insight field. Check parseAIJson extracts it.');
            }
        }
        
        // ============================================
        // CHECK 5: OSINT enrichment running
        // ============================================
        const sourcesUsed = core.DATA.redflags?.sourcesUsed || [];
        const osintSources = sourcesUsed.filter(s => s !== 'Google News');
        
        core.addTest(this.id, 'OSINT enrichment adding sources', osintSources.length > 0,
            osintSources.length > 0 ? `Using: ${osintSources.join(', ')}` : 'Only Google News - OSINT not running');
        
        if (osintSources.length === 0) {
            core.addIssue('warning', 'OSINT not enriching data', 'scripts/ai-osint.js',
                'Only Google News is being used. ProPublica, FEC, OIG, etc. not returning data.',
                'Check enrichFindings() is called. Check API endpoints are accessible. Check entitySources is populated.');
        }
        
        // ============================================
        // CHECK 6: Learning system updating
        // ============================================
        if (core.DATA.learning) {
            const hasQueries = core.DATA.learning.searchQueries?.length >= 8;
            const hasEntities = core.DATA.learning.trackedEntities?.length > 0;
            
            core.addTest(this.id, 'Learning system has search queries (>=8)', hasQueries,
                `${core.DATA.learning.searchQueries?.length || 0} queries`);
            
            core.addTest(this.id, 'Learning system tracking entities', hasEntities,
                `${core.DATA.learning.trackedEntities?.length || 0} entities`);
            
            if (!hasQueries) {
                core.addIssue('warning', 'Too few search queries', 'scripts/ai-files.js',
                    'Scraper needs at least 8 queries for comprehensive coverage',
                    'Check updateLearning() is adding queries from analysis');
            }
        }
        
        // ============================================
        // CHECK 7: Trending has descriptions
        // ============================================
        if (core.DATA.trending?.topics?.length > 0) {
            const topics = core.DATA.trending.topics;
            const withDesc = topics.filter(t => t.description && t.description.length > 10);
            const withReason = topics.filter(t => t.reason && t.reason.length > 5);
            
            core.addTest(this.id, 'Trending topics have descriptions', withDesc.length === topics.length,
                `${withDesc.length}/${topics.length} have descriptions`);
            
            if (withDesc.length < topics.length) {
                core.addIssue('warning', 'Trending missing descriptions', 'scripts/ai-analyzer.js',
                    'Some trending topics have no description. Frontend will show empty content.',
                    'Update GROQ prompt to require description field for each trending topic');
            }
        }
        
        // ============================================
        // CHECK 8: Story ideas have insights
        // ============================================
        if (core.DATA.storyideas?.ideas?.length > 0) {
            const ideas = core.DATA.storyideas.ideas;
            const withInsight = ideas.filter(i => i.insight && i.insight.length > 10);
            const withSearches = ideas.filter(i => i.searches && i.searches.length > 0);
            
            core.addTest(this.id, 'Story ideas have AI insights', withInsight.length > 0,
                `${withInsight.length}/${ideas.length} have insights`);
            
            core.addTest(this.id, 'Story ideas have search terms', withSearches.length > 0,
                `${withSearches.length}/${ideas.length} have searches`);
            
            if (withInsight.length === 0) {
                core.addIssue('warning', 'Story ideas missing AI insights', 'scripts/ai-analyzer.js',
                    'Story ideas need insight field for AI Detective analysis box',
                    'Update GROQ prompt to require insight field for storyIdeas');
            }
            
            if (withSearches.length === 0) {
                core.addIssue('warning', 'Story ideas missing search terms', 'scripts/ai-analyzer.js',
                    'Story ideas need searches array for research buttons',
                    'Update GROQ prompt to require searches field for storyIdeas');
            }
        }
        
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
