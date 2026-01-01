/**
 * TEST MODULE: Data Files Integrity
 * Verifies all JSON data files exist, are valid, and have required structure
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
        
        const structures = {
            'stats': { required: ['charged', 'convicted', 'alleged', 'briefing'], critical: true },
            'investigations': { required: ['cases'], critical: true },
            'figures': { required: ['people'], critical: true },
            'trending': { required: ['topics'], critical: false },
            'storyideas': { required: ['ideas'], critical: false },
            'redflags': { required: ['flags'], critical: true },
            'news': { required: ['articles'], critical: true },
            'learning': { required: ['searchQueries', 'trackedEntities'], critical: false }
        };
        
        let gridHtml = '<div class="data-grid">';
        
        for (const [key, config] of Object.entries(structures)) {
            const data = core.DATA[key];
            const exists = data !== null && data !== undefined;
            const hasContent = exists && Object.keys(data).length > 0;
            
            // Check exists
            if (!exists) {
                core.addTest(this.id, `${key}.json exists`, config.critical ? 'critical' : false, 'File not found or invalid JSON');
                core.addIssue(config.critical ? 'critical' : 'error', `Missing data file: ${key}.json`, 'data/', 
                    'File does not exist or contains invalid JSON', 'Run the AI scan workflow to regenerate this file');
                allPassed = false;
                if (config.critical) criticalFail = true;
            } else {
                core.addTest(this.id, `${key}.json exists`, true, `${Object.keys(data).length} keys`);
                
                // Check required fields
                const missingFields = config.required.filter(f => !(f in data));
                if (missingFields.length > 0) {
                    core.addTest(this.id, `${key}.json has required fields`, false, `Missing: ${missingFields.join(', ')}`);
                    allPassed = false;
                }
                
                // Check has content in arrays
                for (const field of config.required) {
                    if (Array.isArray(data[field]) && data[field].length === 0) {
                        core.addTest(this.id, `${key}.json ${field} not empty`, 'warn', 'Array is empty');
                    }
                }
            }
            
            // Check timestamp
            const hasTimestamp = exists && data?.lastUpdated;
            const age = hasTimestamp ? core.getAge(data.lastUpdated) : Infinity;
            const isStale = age > 7 * 24 * 60 * 60 * 1000;
            
            const cardClass = !exists ? 'error' : (isStale ? 'warning' : 'success');
            gridHtml += `
                <div class="data-card ${cardClass}">
                    <div class="data-card-title">${key}.json</div>
                    <div class="data-card-value" style="color:${exists ? '#75b798' : '#ea868f'}">${exists ? 'OK' : 'MISSING'}</div>
                    <div class="data-card-detail">${hasTimestamp ? core.formatAge(age) : 'No timestamp'}</div>
                </div>
            `;
        }
        
        gridHtml += '</div>';
        core.setDetail(this.id, gridHtml);
        core.setStatus(this.id, criticalFail ? 'critical' : (allPassed ? 'pass' : 'fail'));
    }
});
