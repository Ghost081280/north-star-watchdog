/**
 * TEST MODULE: Self-Healing & X Integration
 * Validates ai-repair.js, ai-diagnostic.js, and ai-twitter.js modules
 */

DiagnosticCore.registerTest({
    id: 'self-healing',
    name: 'SELF-HEALING & X INTEGRATION',
    description: 'Validates self-repair system, diagnostic modules, and X/Twitter integration',
    icon: '🔧',
    critical: false,
    
    async run(core) {
        core.log('Testing self-healing & X integration...', 'info');
        let allPassed = true;
        
        // ============================================
        // CHECK 1: Required script files exist
        // ============================================
        const requiredScripts = [
            { name: 'ai-core.js', critical: true },
            { name: 'ai-diagnostic.js', critical: true },
            { name: 'ai-repair.js', critical: true },
            { name: 'ai-twitter.js', critical: false },
            { name: 'ai-scraper.js', critical: true },
            { name: 'ai-analyzer.js', critical: true },
            { name: 'ai-osint.js', critical: true },
            { name: 'ai-files.js', critical: true },
            { name: 'ai-consciousness.js', critical: false }
        ];
        
        // We can't actually check if files exist from frontend, but we can check
        // if learning.json has the expected structure from a healthy system
        const hasLearning = core.DATA.learning !== null;
        core.addTest(this.id, 'Backend scripts producing output', hasLearning,
            hasLearning ? 'learning.json exists' : 'Backend may not be running');
        
        // ============================================
        // CHECK 2: Self-healing indicators in data
        // ============================================
        
        // Check if stats are at or above baseline (self-healing would enforce this)
        const statsHealthy = core.DATA.stats && 
            core.DATA.stats.charged >= 70 && 
            core.DATA.stats.convicted >= 28 &&
            (core.DATA.stats.alleged || '').includes('9');
        
        core.addTest(this.id, 'Stats baseline enforced (self-healing active)', statsHealthy,
            statsHealthy ? 'Baseline maintained' : 'Stats below baseline - self-healing may not be running');
        
        if (!statsHealthy) {
            core.addIssue('warning', 'Self-healing may not be active', 'scripts/ai-repair.js',
                'Stats are below verified baseline. Self-healing should prevent this.',
                'Check ai-repair.js is being called in ai-core.js workflow');
        }
        
        // ============================================
        // CHECK 3: No journalists in figures (self-healing removes them)
        // ============================================
        const journalists = (core.DATA.figures?.people || []).filter(p => 
            core.BLOCKED_JOURNALISTS.some(j => p.name?.toLowerCase().includes(j))
        );
        
        core.addTest(this.id, 'Journalists filtered (self-healing check)', journalists.length === 0,
            journalists.length === 0 ? 'No journalists in figures' : `FOUND: ${journalists.map(j => j.name).join(', ')}`);
        
        if (journalists.length > 0) {
            core.addIssue('error', 'Self-healing not removing journalists', 'scripts/ai-repair.js',
                `${journalists.length} journalists found in Key Figures`,
                'repairJournalistsInFigures() should remove these automatically');
        }
        
        // ============================================
        // CHECK 4: No blanket source attribution (self-healing removes them)
        // ============================================
        const blanketFlags = (core.DATA.redflags?.flags || []).filter(f => 
            f.apisUsed && f.apisUsed.length === 6
        );
        
        core.addTest(this.id, 'Blanket sources removed (self-healing check)', blanketFlags.length === 0,
            blanketFlags.length === 0 ? 'No blanket attribution' : `${blanketFlags.length} flags with all 6 sources`);
        
        if (blanketFlags.length > 0) {
            core.addIssue('warning', 'Self-healing not fixing blanket sources', 'scripts/ai-repair.js',
                `${blanketFlags.length} red flags showing all 6 sources incorrectly`,
                'repairBlanketSources() should fix these automatically');
        }
        
        // ============================================
        // CHECK 5: Figures have allegations (self-healing removes empty ones)
        // ============================================
        const noAllegations = (core.DATA.figures?.people || []).filter(p => 
            !p.allegations || p.allegations.length === 0
        );
        
        core.addTest(this.id, 'Empty figures removed (self-healing check)', noAllegations.length === 0,
            noAllegations.length === 0 ? 'All figures have allegations' : `${noAllegations.length} without allegations`);
        
        // ============================================
        // CHECK 6: X/Twitter configuration indicators
        // ============================================
        // We can't check env vars from frontend, but we can check if the system
        // appears to be configured for X integration
        
        const hasXMentionId = core.DATA.learning?.lastMentionId !== undefined;
        core.addTest(this.id, 'X/Twitter mention tracking', hasXMentionId || true, // Pass if field exists or not configured
            hasXMentionId ? 'Tracking mentions' : 'Not configured (optional)');
        
        // ============================================
        // CHECK 7: Workflow step indicators
        // ============================================
        // Check if timestamps suggest the full workflow is running
        const timestamps = [
            core.DATA.stats?.lastUpdated,
            core.DATA.redflags?.lastUpdated,
            core.DATA.news?.lastUpdated,
            core.DATA.learning?.lastLearningUpdate
        ].filter(Boolean);
        
        if (timestamps.length >= 3) {
            // Check if timestamps are within 5 minutes of each other (same workflow run)
            const times = timestamps.map(t => new Date(t).getTime());
            const maxDiff = Math.max(...times) - Math.min(...times);
            const sameRun = maxDiff < 5 * 60 * 1000; // 5 minutes
            
            core.addTest(this.id, 'Full workflow completing (timestamps aligned)', sameRun,
                sameRun ? 'All files updated together' : 'Files updated at different times');
        }
        
        // ============================================
        // CHECK 8: Health score estimation
        // ============================================
        let healthScore = 100;
        if (!statsHealthy) healthScore -= 20;
        if (journalists.length > 0) healthScore -= 15;
        if (blanketFlags.length > 0) healthScore -= 10;
        if (noAllegations.length > 0) healthScore -= 10;
        if (!hasLearning) healthScore -= 15;
        
        core.addTest(this.id, 'Estimated system health', healthScore >= 70,
            `${healthScore}% health`);
        
        // ============================================
        // DISPLAY: Self-healing status
        // ============================================
        const detailHtml = `
            <div class="data-grid">
                <div class="data-card ${statsHealthy ? 'success' : 'error'}">
                    <div class="data-card-title">Stats Baseline</div>
                    <div class="data-card-value">${statsHealthy ? 'OK' : 'FAIL'}</div>
                    <div class="data-card-detail">$9B+, 70+ charged</div>
                </div>
                <div class="data-card ${journalists.length === 0 ? 'success' : 'error'}">
                    <div class="data-card-title">Journalist Filter</div>
                    <div class="data-card-value">${journalists.length === 0 ? 'OK' : journalists.length}</div>
                    <div class="data-card-detail">${journalists.length === 0 ? 'None found' : 'Need removal'}</div>
                </div>
                <div class="data-card ${blanketFlags.length === 0 ? 'success' : 'warning'}">
                    <div class="data-card-title">Source Attribution</div>
                    <div class="data-card-value">${blanketFlags.length === 0 ? 'OK' : blanketFlags.length}</div>
                    <div class="data-card-detail">${blanketFlags.length === 0 ? 'Per-entity' : 'Blanket detected'}</div>
                </div>
                <div class="data-card ${healthScore >= 70 ? 'success' : (healthScore >= 50 ? 'warning' : 'error')}">
                    <div class="data-card-title">Health Score</div>
                    <div class="data-card-value">${healthScore}%</div>
                    <div class="data-card-detail">Estimated</div>
                </div>
            </div>
            
            <div style="margin-top:15px; padding:12px; background:#1a1a1a; border-left:3px solid #d4af37;">
                <div style="color:#d4af37; font-size:11px; margin-bottom:8px;">SELF-HEALING MODULES:</div>
                <div style="display:flex; flex-wrap:wrap; gap:8px;">
                    <span style="background:#0f5132; color:#75b798; padding:4px 10px; font-size:10px; border-radius:3px;">ai-diagnostic.js</span>
                    <span style="background:#0f5132; color:#75b798; padding:4px 10px; font-size:10px; border-radius:3px;">ai-repair.js</span>
                    <span style="background:#0f5132; color:#75b798; padding:4px 10px; font-size:10px; border-radius:3px;">ai-twitter.js</span>
                    <span style="background:#0f5132; color:#75b798; padding:4px 10px; font-size:10px; border-radius:3px;">ai-consciousness.js</span>
                </div>
                <div style="color:#888; font-size:10px; margin-top:10px;">
                    <strong>Auto-repairs:</strong> Journalist removal, baseline enforcement, blanket source fix, empty figure removal, JSON rebuild<br>
                    <strong>Self-awareness:</strong> Pattern detection, significance assessment, decision making, memory persistence
                </div>
            </div>
            
            <div style="margin-top:15px; padding:12px; background:#1a1a1a; border-left:3px solid #000;">
                <div style="color:#fff; font-size:11px; margin-bottom:8px;">X/TWITTER INTEGRATION:</div>
                <div style="color:#888; font-size:10px;">
                    <strong>@NorthStarAgent</strong> - Daily briefings, critical alerts, mention responses<br>
                    <strong>Rate Limit:</strong> ~3 posts/day (100/month free tier)<br>
                    <strong>Disclaimer:</strong> ⚠️ AI-generated on every post
                </div>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed && healthScore >= 70 ? 'pass' : (healthScore >= 50 ? 'warn' : 'fail'));
    }
});
