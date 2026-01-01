/**
 * TEST MODULE: AI Briefing Quality
 * Validates briefing content, format, and data synthesis
 */

DiagnosticCore.registerTest({
    id: 'briefing',
    name: 'AI BRIEFING QUALITY',
    description: 'Validates briefing is comprehensive, synthesized, and not a placeholder',
    icon: '🤖',
    critical: true,
    
    async run(core) {
        core.log('Testing AI briefing quality...', 'info');
        let allPassed = true;
        
        if (!core.DATA.stats?.briefing) {
            core.addTest(this.id, 'Briefing exists', 'critical');
            core.addIssue('critical', 'No briefing in stats', 'data/stats.json',
                'Briefing field is missing entirely',
                'Check ai-files.js writes briefing to stats.json');
            core.setStatus(this.id, 'critical');
            return;
        }
        
        const briefing = core.DATA.stats.briefing;
        
        // ============================================
        // CHECK 1: Length
        // ============================================
        const lengthOk = briefing.length >= 150;
        core.addTest(this.id, 'Briefing has substantial content (>=150 chars)', lengthOk,
            `${briefing.length} characters`);
        if (!lengthOk) {
            allPassed = false;
            core.addIssue('error', 'Briefing too short', 'scripts/ai-analyzer.js',
                `Only ${briefing.length} chars. Should be 3-4 paragraphs.`,
                'Update GROQ prompt to require comprehensive briefing');
        }
        
        // ============================================
        // CHECK 2: Not a placeholder
        // ============================================
        const placeholders = ['unavailable', 'loading', 'standing by', 'no data', 'no briefing'];
        const isPlaceholder = placeholders.some(p => briefing.toLowerCase().includes(p));
        core.addTest(this.id, 'Briefing is not a placeholder', !isPlaceholder);
        if (isPlaceholder) {
            allPassed = false;
            core.addIssue('error', 'Briefing is a placeholder', 'scripts/ai-files.js',
                'Briefing contains placeholder text. AI did not generate real content.',
                'Check GROQ API. Check isPlaceholderBriefing() function.');
        }
        
        // ============================================
        // CHECK 3: No greeting
        // ============================================
        const hasGreeting = /^(Good morning|Good afternoon|Good evening|Hello|Hi)\b/i.test(briefing);
        core.addTest(this.id, 'Briefing does not start with greeting', !hasGreeting,
            hasGreeting ? 'Starts with greeting - should be stripped' : 'Clean');
        if (hasGreeting) {
            core.addIssue('warning', 'Briefing has time-based greeting', 'scripts/ai-files.js',
                'Briefing starts with "Good morning/afternoon" which is time-sensitive',
                'fixBriefingGreeting() should strip this. Check the regex.');
        }
        
        // ============================================
        // CHECK 4: Multi-sentence (synthesis)
        // ============================================
        const sentences = briefing.split(/[.!?]+/).filter(s => s.trim().length > 10);
        const isMultiSentence = sentences.length >= 3;
        core.addTest(this.id, 'Briefing synthesizes multiple points (3+ sentences)', isMultiSentence,
            `${sentences.length} sentences`);
        if (!isMultiSentence) {
            core.addIssue('warning', 'Briefing not comprehensive', 'scripts/ai-analyzer.js',
                'Briefing has fewer than 3 sentences. May just be echoing headline.',
                'Update GROQ prompt: briefing must cover ALL findings from scan');
        }
        
        // ============================================
        // CHECK 5: Not just breaking news
        // ============================================
        const isJustBreaking = briefing.toUpperCase().startsWith('BREAKING:') && sentences.length < 3;
        core.addTest(this.id, 'Briefing is not just breaking news', !isJustBreaking,
            isJustBreaking ? 'Just echoing headline' : 'Has synthesis');
        if (isJustBreaking) {
            allPassed = false;
            core.addIssue('error', 'Briefing only echoes breaking news', 'scripts/ai-analyzer.js',
                'Briefing should synthesize ALL findings, not just repeat the top headline',
                'Update GROQ prompt to explicitly require synthesis of figures, investigations, red flags, trends');
        }
        
        // ============================================
        // CHECK 6: Contains relevant keywords
        // ============================================
        const keywords = ['fraud', 'minnesota', 'million', 'billion', 'charged', 'investigation'];
        const foundKeywords = keywords.filter(k => briefing.toLowerCase().includes(k));
        const hasKeywords = foundKeywords.length >= 2;
        core.addTest(this.id, 'Briefing contains relevant keywords', hasKeywords,
            `Found: ${foundKeywords.join(', ')}`);
        
        // ============================================
        // CHECK 7: Not the hardcoded fallback
        // ============================================
        const fallbackStart = 'BREAKING: Federal childcare funding frozen nationwide';
        const isFallback = briefing.startsWith(fallbackStart);
        core.addTest(this.id, 'Briefing is AI-generated (not hardcoded fallback)', !isFallback,
            isFallback ? 'USING FALLBACK TEXT' : 'Appears AI-generated');
        if (isFallback) {
            core.addIssue('warning', 'Using hardcoded fallback briefing', 'scripts/ai-files.js',
                'The briefing matches the hardcoded fallback exactly. GROQ may not be generating.',
                'Check GROQ_API_KEY. Check ai-analyzer.js is returning briefing. Check preservation logic.');
        }
        
        // ============================================
        // DISPLAY: Briefing preview
        // ============================================
        const detailHtml = `
            <div style="margin-top:15px; padding:15px; background:#1a1a1a; border-left:3px solid #d4af37;">
                <div style="color:#d4af37; font-size:10px; margin-bottom:10px;">CURRENT BRIEFING (${briefing.length} chars, ${sentences.length} sentences):</div>
                <div style="color:#ccc; line-height:1.6; font-size:12px;">${core.escapeHtml(briefing)}</div>
            </div>
            <div style="margin-top:10px; font-size:10px; color:#666;">
                <strong>Quality Checks:</strong> Length ${lengthOk ? '✓' : '✗'} | Not placeholder ${!isPlaceholder ? '✓' : '✗'} | Multi-sentence ${isMultiSentence ? '✓' : '✗'} | Not just breaking ${!isJustBreaking ? '✓' : '✗'}
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : (isPlaceholder || isJustBreaking ? 'fail' : 'warn'));
    }
});
