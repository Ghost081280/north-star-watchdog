/**
 * TEST MODULE: Data Files Integrity
 * Verifies all JSON data files exist, are valid, and have required structure
 * 
 * DYNAMIC: Discovers files by attempting to load them, not from hardcoded list
 */

DiagnosticCore.registerTest({
    id: 'data-files',
    name: 'DATA FILE INTEGRITY',
    description: 'Verifies all JSON data files exist, are valid, and have required structure',
    icon: '📁',
    critical: true,
    
    async run(core) {
        core.log('Testing data file integrity...', 'info');
        let allPassed = true;
        let criticalFail = false;
        
        // Define expected structure for known file types
        // Files not in this list will still be checked if they exist in core.DATA
        const knownStructures = {
            'stats': { required: ['charged', 'convicted', 'alleged', 'briefing'], critical: true },
            'investigations': { required: ['cases'], critical: true },
            'figures': { required: ['people'], critical: true },
            'trending': { required: ['topics'], critical: false },
            'storyideas': { required: ['ideas'], critical: false },
            'redflags': { required: ['flags'], critical: true },
            'news': { required: ['articles'], critical: true },
            'learning': { required: ['searchQueries', 'trackedEntities'], critical: false }
        };
        
        // DYNAMIC: Check what's actually in core.DATA
        // This handles files that may have been added or removed
        const loadedFiles = Object.keys(core.DATA).filter(key => core.DATA[key] !== null);
        
        core.log(`Found ${loadedFiles.length} loaded data files`, 'info');
        
        let gridHtml = '<div class="data-grid">';
        
        // Check each loaded file
        for (const key of loadedFiles) {
            const data = core.DATA[key];
            const config = knownStructures[key] || { required: [], critical: false };
            const displayName = this.keyToFilename(key);
            
            // File exists (we know this because it's in loadedFiles)
            const hasContent = data && Object.keys(data).length > 0;
            
            core.addTest(this.id, `${displayName} exists`, true, `${Object.keys(data).length} keys`);
            
            // Check required fields if we know the structure
            if (config.required.length > 0) {
                const missingFields = config.required.filter(f => !(f in data));
                if (missingFields.length > 0) {
                    core.addTest(this.id, `${displayName} has required fields`, false, 
                        `Missing: ${missingFields.join(', ')}`);
                    allPassed = false;
                    if (config.critical) criticalFail = true;
                } else {
                    core.addTest(this.id, `${displayName} has required fields`, true, 'All present');
                }
                
                // Check if arrays are empty
                for (const field of config.required) {
                    if (Array.isArray(data[field]) && data[field].length === 0) {
                        core.addTest(this.id, `${displayName} ${field} not empty`, 'warn', 'Array is empty');
                    }
                }
            }
            
            // Check timestamp
            const hasTimestamp = data?.lastUpdated;
            const age = hasTimestamp ? core.getAge(data.lastUpdated) : Infinity;
            const isStale = age > 7 * 24 * 60 * 60 * 1000;
            
            const cardClass = isStale ? 'warning' : 'success';
            gridHtml += `
                <div class="data-card ${cardClass}">
                    <div class="data-card-title">${displayName}</div>
                    <div class="data-card-value" style="color:#75b798">OK</div>
                    <div class="data-card-detail">${hasTimestamp ? core.formatAge(age) : 'No timestamp'}</div>
                </div>
            `;
        }
        
        // Check for expected critical files that might be missing
        const criticalFiles = ['stats', 'news', 'redflags'];
        for (const key of criticalFiles) {
            if (!loadedFiles.includes(key)) {
                const displayName = this.keyToFilename(key);
                core.addTest(this.id, `${displayName} exists`, 'critical', 'File not found or invalid JSON');
                core.addIssue('critical', `Missing critical file: ${displayName}`, 'data/', 
                    'File does not exist or contains invalid JSON', 
                    'Run the AI scan workflow to regenerate this file');
                criticalFail = true;
                
                gridHtml += `
                    <div class="data-card error">
                        <div class="data-card-title">${displayName}</div>
                        <div class="data-card-value" style="color:#ea868f">MISSING</div>
                        <div class="data-card-detail">Critical file</div>
                    </div>
                `;
            }
        }
        
        gridHtml += '</div>';
        
        // Add dynamic discovery note
        gridHtml += `
            <div style="margin-top:15px; padding:10px; background:#1a1a1a; border-radius:6px; font-size:11px; color:#888;">
                <strong style="color:#d4af37;">Dynamic Discovery:</strong> 
                Checked ${loadedFiles.length} files found in data/ folder.
                New files are automatically detected. Deleted files are ignored.
            </div>
        `;
        
        core.setDetail(this.id, gridHtml);
        core.setStatus(this.id, criticalFail ? 'critical' : (allPassed ? 'pass' : 'fail'));
    },
    
    // Helper to convert DATA key to filename
    keyToFilename(key) {
        const map = {
            'stats': 'stats.json',
            'redflags': 'red-flags.json',
            'storyideas': 'story-ideas.json',
            'news': 'news.json',
            'figures': 'figures.json',
            'investigations': 'investigations.json',
            'trending': 'trending.json',
            'learning': 'learning.json'
        };
        return map[key] || `${key}.json`;
    }
});
