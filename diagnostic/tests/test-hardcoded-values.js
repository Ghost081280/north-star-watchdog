/**
 * TEST MODULE: Hardcoded Values Detection
 * Checks for hardcoded values that should be dynamic from data files
 */

DiagnosticCore.registerTest({
    id: 'hardcoded',
    name: 'HARDCODED VALUES DETECTION',
    description: 'Checks for hardcoded values, blanket source attribution, and lazy shortcuts',
    icon: '🔒',
    critical: true,
    
    async run(core) {
        core.log('Checking for hardcoded values...', 'info');
        let allPassed = true;
        
        // ============================================
        // CHECK 1: Stats have verified source
        // ============================================
        if (core.DATA.stats) {
            const hasSource = core.DATA.stats.source && core.DATA.stats.source.length > 10;
            core.addTest(this.id, 'Stats have source citation (not hardcoded)', hasSource,
                hasSource ? core.DATA.stats.source : 'No source = likely hardcoded');
            if (!hasSource) {
                allPassed = false;
                core.addIssue('warning', 'Stats missing source citation', 'data/stats.json',
                    'Stats appear to be hardcoded without source verification',
                    'Add source and sourceUrl fields to stats.json via ai-files.js');
            }
            
            const hasSourceUrl = core.DATA.stats.sourceUrl && core.DATA.stats.sourceUrl.startsWith('http');
            core.addTest(this.id, 'Stats have verifiable source URL', hasSourceUrl,
                hasSourceUrl ? 'URL present' : 'No URL = cannot verify');
            if (!hasSourceUrl) allPassed = false;
        }
        
        // ============================================
        // CHECK 2: Red flags NOT using blanket sources
        // ============================================
        if (core.DATA.redflags?.flags?.length > 0) {
            const flags = core.DATA.redflags.flags;
            
            // Count flags with all 6 sources (the bug we fixed)
            const blanketFlags = flags.filter(f => f.apisUsed && f.apisUsed.length === 6);
            const allHaveSix = blanketFlags.length === flags.length;
            
            core.addTest(this.id, 'Red flags use per-entity sources (not blanket ALL)', !allHaveSix,
                allHaveSix ? `BUG: All ${flags.length} flags show 6 sources` : `${blanketFlags.length}/${flags.length} show all 6`);
            
            if (allHaveSix) {
                allPassed = false;
                core.addIssue('critical', 'Blanket source attribution detected', 'scripts/ai-files.js',
                    'All red flags show all 6 API sources regardless of which actually returned data. This happens when ai-analyzer.js sets apisUsed before ai-files.js can do per-entity tracking.',
                    'Remove apisUsed assignment from ai-analyzer.js processedFlags. Let ai-files.js handle it with getSourcesForRedFlag(rf, osint.entitySources)');
            } else if (blanketFlags.length > 0) {
                core.addIssue('warning', 'Some flags have blanket sources', 'scripts/ai-files.js',
                    `${blanketFlags.length} flags show all 6 sources`,
                    'Check if old flags in data need to be cleared, or if ai-files.js getSourcesForRedFlag is working');
            }
            
            // Check for Google-only flags (OSINT not enriching)
            const googleOnly = flags.filter(f => f.apisUsed?.length === 1 && f.apisUsed[0] === 'Google News');
            if (googleOnly.length > flags.length * 0.7 && flags.length > 2) {
                core.addTest(this.id, 'OSINT APIs enriching data', 'warn',
                    `${googleOnly.length}/${flags.length} only show Google News - OSINT may not be running`);
                core.addIssue('warning', 'Most flags only show Google News', 'scripts/ai-osint.js',
                    'OSINT APIs may not be returning data or entitySources not being populated correctly',
                    'Check console output during scan. Verify ai-osint.js enrichFindings() is being called and entitySources is populated.');
            } else {
                core.addTest(this.id, 'OSINT APIs enriching data', true, `${flags.length - googleOnly.length}/${flags.length} have multiple sources`);
            }
        }
        
        // ============================================
        // CHECK 3: Investigations have source URLs
        // ============================================
        if (core.DATA.investigations?.cases?.length > 0) {
            const cases = core.DATA.investigations.cases;
            const withoutSource = cases.filter(c => !c.sourceUrl || !c.sourceUrl.startsWith('http'));
            
            core.addTest(this.id, 'All investigations have source URLs', withoutSource.length === 0,
                withoutSource.length > 0 ? `${withoutSource.length} missing URLs: ${withoutSource.map(c => c.name).join(', ')}` : 'All have URLs');
            
            if (withoutSource.length > 0) {
                allPassed = false;
                core.addIssue('error', 'Investigations missing source URLs', 'data/investigations.json',
                    `${withoutSource.length} investigations cannot be verified: ${withoutSource.map(c => c.name).join(', ')}`,
                    'Filter investigations without valid sourceUrl in ai-files.js validateInv()');
            }
        }
        
        // ============================================
        // CHECK 4: Figures have allegations
        // ============================================
        if (core.DATA.figures?.people?.length > 0) {
            const people = core.DATA.figures.people;
            const withoutAllegations = people.filter(p => !p.allegations || p.allegations.length === 0);
            
            core.addTest(this.id, 'All figures have specific allegations', withoutAllegations.length === 0,
                withoutAllegations.length > 0 ? `${withoutAllegations.length} missing: ${withoutAllegations.map(p => p.name).join(', ')}` : 'All have allegations');
            
            if (withoutAllegations.length > 0) {
                allPassed = false;
                core.addIssue('error', 'Key figures missing allegations', 'scripts/ai-files.js',
                    `${withoutAllegations.length} figures have no specific fraud allegations`,
                    'Figures without allegations should be filtered in ai-files.js VALID_ALLEGATIONS check');
            }
        }
        
        // ============================================
        // CHECK 5: Briefing is not fallback
        // ============================================
        if (core.DATA.stats?.briefing) {
            const briefing = core.DATA.stats.briefing;
            const fallbackText = 'BREAKING: Federal childcare funding frozen nationwide';
            const isFallback = briefing.startsWith(fallbackText);
            
            core.addTest(this.id, 'Briefing is AI-generated (not hardcoded fallback)', !isFallback,
                isFallback ? 'Using hardcoded fallback text' : 'Appears to be AI-generated');
            
            if (isFallback) {
                core.addIssue('warning', 'Briefing using hardcoded fallback', 'scripts/ai-files.js',
                    'The briefing text matches the hardcoded fallback. GROQ API may not be generating briefings.',
                    'Check GROQ API key is set. Check ai-analyzer.js briefing prompt. Check isPlaceholderBriefing() in ai-files.js.');
            }
        }
        
        // ============================================
        // CHECK 6: Trending/Story Ideas not empty
        // ============================================
        const hasTrending = core.DATA.trending?.topics?.length > 0;
        core.addTest(this.id, 'Trending topics populated (not empty)', hasTrending,
            hasTrending ? `${core.DATA.trending.topics.length} topics` : 'EMPTY - preservation may have failed');
        
        const hasIdeas = core.DATA.storyideas?.ideas?.length > 0;
        core.addTest(this.id, 'Story ideas populated (not empty)', hasIdeas,
            hasIdeas ? `${core.DATA.storyideas.ideas.length} ideas` : 'EMPTY - preservation may have failed');
        
        if (!hasTrending || !hasIdeas) {
            core.addIssue('error', 'Empty content arrays', 'scripts/ai-files.js',
                `Trending: ${hasTrending ? 'OK' : 'EMPTY'}, Story Ideas: ${hasIdeas ? 'OK' : 'EMPTY'}`,
                'Check preservation logic: only update if newTopics.length > 0');
        }
        
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
