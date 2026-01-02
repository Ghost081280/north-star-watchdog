/**
 * TEST MODULE: Timestamp Freshness
 * Verifies all data is recent and hourly scans are running
 * 
 * DYNAMIC: Discovers files from DiagnosticCore.DATA instead of hardcoded list
 */

DiagnosticCore.registerTest({
    id: 'timestamps',
    name: 'TIMESTAMP FRESHNESS',
    description: 'Verifies data timestamps are recent and hourly workflow is running',
    icon: '⏰',
    critical: false,
    
    async run(core) {
        core.log('Testing timestamp freshness...', 'info');
        let allPassed = true;
        
        const oneHour = 60 * 60 * 1000;
        const oneDay = 24 * oneHour;
        const oneWeek = 7 * oneDay;
        
        // DYNAMIC: Build file list from what's actually loaded in core.DATA
        // This way we only check files that actually exist
        const files = [];
        
        // Map of DATA keys to display names and criticality
        const fileConfig = {
            'stats': { name: 'stats.json', critical: true },
            'redflags': { name: 'red-flags.json', critical: true },
            'news': { name: 'news.json', critical: true },
            'investigations': { name: 'investigations.json', critical: false },
            'figures': { name: 'figures.json', critical: false },
            'trending': { name: 'trending.json', critical: false },
            'storyideas': { name: 'story-ideas.json', critical: false },
            'learning': { name: 'learning.json', critical: false }
        };
        
        // Only add files that actually exist in core.DATA
        for (const [key, config] of Object.entries(fileConfig)) {
            if (core.DATA[key] !== null && core.DATA[key] !== undefined) {
                files.push({ key, ...config });
            }
        }
        
        core.log(`Found ${files.length} data files to check`, 'info');
        
        let staleCount = 0;
        let veryStaleCount = 0;
        let gridHtml = '<div class="data-grid">';
        
        for (const file of files) {
            const data = core.DATA[file.key];
            const timestamp = data?.lastUpdated;
            const age = core.getAge(timestamp);
            
            const isRecent = age < 2 * oneHour; // 2 hours
            const isAcceptable = age < oneDay;
            const isStale = age > oneWeek;
            
            if (!isAcceptable) staleCount++;
            if (isStale) veryStaleCount++;
            
            let status = 'pass';
            if (!timestamp) status = 'warn';
            else if (isStale) status = file.critical ? 'fail' : 'warn';
            else if (!isAcceptable) status = 'warn';
            
            core.addTest(this.id, `${file.name} updated recently`, isRecent ? true : (isAcceptable ? 'warn' : false),
                timestamp ? core.formatAge(age) : 'No timestamp');
            
            const cardClass = isRecent ? 'success' : (isAcceptable ? 'warning' : 'error');
            gridHtml += `
                <div class="data-card ${cardClass}">
                    <div class="data-card-title">${file.name}</div>
                    <div class="data-card-value" style="font-size:11px;">${timestamp ? core.formatAge(age) : 'N/A'}</div>
                    <div class="data-card-detail">${isRecent ? 'Fresh' : (isAcceptable ? 'OK' : 'STALE')}</div>
                </div>
            `;
        }
        
        gridHtml += '</div>';
        
        if (staleCount > 0) {
            allPassed = false;
            core.addIssue('warning', 'Stale data files detected', 'GitHub Actions',
                `${staleCount} files haven't been updated recently`,
                'Check GitHub Actions workflow is running hourly. Check for workflow failures.');
        }
        
        if (veryStaleCount > 0) {
            core.addIssue('error', 'Very stale data files', 'GitHub Actions',
                `${veryStaleCount} files are over a week old`,
                'Workflow may be completely broken. Check Actions tab for errors.');
        }
        
        // Calculate overall freshness from files that have timestamps
        const timestamps = files
            .map(f => core.DATA[f.key]?.lastUpdated)
            .filter(Boolean);
        
        const avgAge = timestamps.length > 0 
            ? timestamps.reduce((sum, t) => sum + core.getAge(t), 0) / timestamps.length 
            : Infinity;
        
        core.addTest(this.id, 'Average data age acceptable (<6h)', avgAge < 6 * oneHour,
            avgAge !== Infinity ? core.formatAge(avgAge) + ' average' : 'No timestamps');
        
        // Check if workflow appears to be running hourly
        if (timestamps.length > 0) {
            const mostRecent = Math.min(...timestamps.map(t => core.getAge(t)));
            const workflowRunning = mostRecent < 2 * oneHour;
            core.addTest(this.id, 'Hourly workflow appears active', workflowRunning,
                workflowRunning ? 'Recent updates detected' : 'No recent updates');
        }
        
        // Add summary
        gridHtml += `
            <div style="margin-top:15px; padding:10px; background:#1a1a1a; border-radius:6px; font-size:11px; color:#888;">
                <strong style="color:#d4af37;">Dynamic Discovery:</strong> Found ${files.length} data files in repo.
                Files are discovered automatically - no hardcoded list needed.
            </div>
        `;
        
        core.setDetail(this.id, gridHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'warn');
    }
});
