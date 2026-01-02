/**
 * TEST MODULE: AI Self-Awareness
 * Verifies Agent Polaris can see and understand its entire codebase
 */

DiagnosticCore.registerTest({
    id: 'self-awareness',
    name: 'AI SELF-AWARENESS',
    description: 'Checks if Agent Polaris has full visibility into its own codebase',
    icon: '🧠',
    critical: false,
    
    async run(core) {
        core.log('Testing AI self-awareness systems...', 'info');
        
        // Try to load self-awareness report
        // Path is relative to diagnostic/ folder, so go up one level to data/
        let awarenessData = null;
        try {
            const response = await fetch('../data/self-awareness.json?t=' + Date.now());
            if (response.ok) {
                awarenessData = await response.json();
            }
        } catch (e) {
            core.log('Self-awareness data not yet generated', 'warn');
        }

        // ============================================
        // SECTION 1: Self-Awareness Data Exists
        // ============================================
        const hasAwareness = !!awarenessData;
        core.addTest(this.id, 'Self-awareness report exists', hasAwareness,
            hasAwareness ? 'Agent Polaris knows itself' : 'Run ai-self-awareness.js to generate');

        if (!hasAwareness) {
            core.addIssue('warning', 'Self-awareness not initialized', 'scripts/ai-self-awareness.js',
                'Agent Polaris has not scanned its own codebase yet',
                'Run: node scripts/ai-self-awareness.js to initialize self-awareness');
            
            // Show instructions
            let html = `
                <div class="awareness-missing">
                    <h4>🧠 Self-Awareness Not Initialized</h4>
                    <p>Agent Polaris needs to scan its own codebase to enable self-awareness.</p>
                    <div class="code-block">
                        <code>node scripts/ai-self-awareness.js</code>
                    </div>
                    <p>This will allow Polaris to:</p>
                    <ul>
                        <li>Understand all its capabilities</li>
                        <li>Identify limitations and improvements</li>
                        <li>Map connections between components</li>
                        <li>Provide better self-reflection</li>
                    </ul>
                </div>
                <style>
                    .awareness-missing { 
                        background: rgba(139, 92, 246, 0.1); 
                        border: 1px solid rgba(139, 92, 246, 0.3);
                        border-radius: 8px; 
                        padding: 20px; 
                    }
                    .awareness-missing h4 { color: #a78bfa; margin-bottom: 12px; }
                    .awareness-missing ul { margin: 12px 0 0 20px; }
                    .awareness-missing li { margin: 6px 0; color: #a0a0a0; }
                    .code-block { 
                        background: #1a1a1a; 
                        padding: 12px; 
                        border-radius: 6px; 
                        margin: 12px 0;
                        font-family: monospace;
                    }
                </style>
            `;
            core.setDetail(this.id, html);
            core.setStatus(this.id, 'warn');
            return;
        }

        // ============================================
        // SECTION 2: Codebase Coverage
        // ============================================
        const stats = awarenessData.codebaseStats || {};
        
        core.addTest(this.id, 'Scripts scanned', stats.scriptFiles > 5,
            `${stats.scriptFiles} script files`);
        
        core.addTest(this.id, 'Data files tracked', stats.dataFiles > 5,
            `${stats.dataFiles} data files`);
        
        core.addTest(this.id, 'Frontend files mapped', stats.frontendFiles > 2,
            `${stats.frontendFiles} frontend files`);

        // ============================================
        // SECTION 3: Capabilities Identified
        // ============================================
        const capabilities = awarenessData.capabilities || [];
        
        core.addTest(this.id, 'Capabilities identified', capabilities.length >= 5,
            `${capabilities.length} capabilities known`);

        const expectedCapabilities = [
            'News Scraping', 'AI Analysis', 'OSINT Enrichment', 
            'Self-Reflection', 'Self-Healing'
        ];
        
        for (const cap of expectedCapabilities) {
            const found = capabilities.some(c => c.name === cap);
            core.addTest(this.id, `Capability: ${cap}`, found,
                found ? 'Active' : 'Missing');
        }

        // ============================================
        // SECTION 4: Health Assessment
        // ============================================
        const health = awarenessData.health || {};
        
        core.addTest(this.id, 'Health score acceptable', health.score >= 70,
            `${health.score}% health`);
        
        core.addTest(this.id, 'No critical issues', health.status !== 'critical',
            health.status || 'unknown');

        // ============================================
        // SECTION 5: Limitations Awareness
        // ============================================
        const limitations = awarenessData.limitations || [];
        const improvements = awarenessData.improvements || [];

        core.addTest(this.id, 'Limitations identified', limitations.length > 0,
            `${limitations.length} known limitations`);
        
        core.addTest(this.id, 'Improvements suggested', improvements.length > 0,
            `${improvements.length} improvement ideas`);

        // ============================================
        // BUILD DETAIL HTML
        // ============================================
        let html = '<div class="awareness-report">';

        // Identity
        html += `
            <div class="awareness-section">
                <h4>🤖 Identity</h4>
                <div class="identity-card">
                    <div class="identity-name">${awarenessData.identity?.name || 'Agent Polaris'}</div>
                    <div class="identity-purpose">${awarenessData.identity?.purpose || 'AI Investigation Assistant'}</div>
                    <div class="identity-version">v${awarenessData.identity?.version || '5.0'}</div>
                </div>
            </div>
        `;

        // Stats
        html += `
            <div class="awareness-section">
                <h4>📊 Codebase Statistics</h4>
                <div class="stats-grid">
                    <div class="stat-box">
                        <span class="stat-value">${stats.totalFiles || 0}</span>
                        <span class="stat-label">Total Files</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value">${stats.scriptFiles || 0}</span>
                        <span class="stat-label">Scripts</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value">${stats.dataFiles || 0}</span>
                        <span class="stat-label">Data Files</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-value">${stats.frontendFiles || 0}</span>
                        <span class="stat-label">Frontend</span>
                    </div>
                </div>
            </div>
        `;

        // Capabilities
        html += `
            <div class="awareness-section">
                <h4>💪 Known Capabilities</h4>
                <div class="capabilities-list">
        `;
        
        for (const cap of capabilities) {
            html += `
                <div class="capability-item">
                    <div class="cap-name">${cap.name}</div>
                    <div class="cap-desc">${cap.description}</div>
                    <div class="cap-file">📄 ${cap.file}</div>
                </div>
            `;
        }
        html += '</div></div>';

        // Limitations
        if (limitations.length > 0) {
            html += `
                <div class="awareness-section">
                    <h4>⚠️ Known Limitations</h4>
                    <div class="limitations-list">
            `;
            
            for (const lim of limitations) {
                html += `
                    <div class="limitation-item">
                        <div class="lim-area">${lim.area}</div>
                        <div class="lim-issue">${lim.issue}</div>
                        ${lim.suggestion ? `<div class="lim-suggestion">💡 ${lim.suggestion}</div>` : ''}
                    </div>
                `;
            }
            html += '</div></div>';
        }

        // Improvements
        if (improvements.length > 0) {
            html += `
                <div class="awareness-section">
                    <h4>💡 Suggested Improvements</h4>
                    <div class="improvements-list">
            `;
            
            for (const imp of improvements) {
                const priorityClass = imp.priority === 'high' ? 'priority-high' : 
                                     imp.priority === 'medium' ? 'priority-medium' : 'priority-low';
                html += `
                    <div class="improvement-item ${priorityClass}">
                        <div class="imp-area">${imp.area}</div>
                        <div class="imp-suggestion">${imp.suggestion}</div>
                        <span class="imp-priority">${imp.priority}</span>
                    </div>
                `;
            }
            html += '</div></div>';
        }

        // Health
        html += `
            <div class="awareness-section">
                <h4>❤️ Health Assessment</h4>
                <div class="health-display">
                    <div class="health-score ${health.status}">${health.score}%</div>
                    <div class="health-status">${health.status?.toUpperCase() || 'UNKNOWN'}</div>
                    ${health.issues?.length > 0 ? `
                        <div class="health-issues">
                            ${health.issues.map(i => `<div class="health-issue">• ${i}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Timestamp
        html += `
            <div class="awareness-timestamp">
                Last self-scan: ${awarenessData.timestamp ? new Date(awarenessData.timestamp).toLocaleString() : 'Unknown'}
            </div>
        `;

        html += '</div>';

        // Add styles
        html += `
            <style>
                .awareness-report { }
                .awareness-section { 
                    margin: 20px 0; 
                    padding: 16px; 
                    background: rgba(255,255,255,0.02); 
                    border-radius: 8px;
                }
                .awareness-section h4 { 
                    margin: 0 0 12px 0; 
                    color: var(--gold); 
                    font-size: 14px;
                }
                
                .identity-card {
                    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(212, 175, 55, 0.1));
                    border: 1px solid rgba(139, 92, 246, 0.3);
                    border-radius: 8px;
                    padding: 16px;
                    text-align: center;
                }
                .identity-name { font-size: 20px; font-weight: 700; color: #a78bfa; }
                .identity-purpose { font-size: 13px; color: #a0a0a0; margin: 4px 0; }
                .identity-version { font-size: 11px; color: #666; }
                
                .stats-grid { 
                    display: grid; 
                    grid-template-columns: repeat(4, 1fr); 
                    gap: 10px; 
                }
                .stat-box { 
                    background: rgba(0,0,0,0.3); 
                    padding: 12px; 
                    border-radius: 6px; 
                    text-align: center;
                }
                .stat-box .stat-value { 
                    display: block; 
                    font-size: 24px; 
                    font-weight: 700; 
                    color: var(--gold); 
                }
                .stat-box .stat-label { 
                    font-size: 11px; 
                    color: #888; 
                }
                
                .capabilities-list { display: flex; flex-direction: column; gap: 10px; }
                .capability-item {
                    background: rgba(34, 197, 94, 0.1);
                    border: 1px solid rgba(34, 197, 94, 0.2);
                    border-radius: 6px;
                    padding: 12px;
                }
                .cap-name { font-weight: 600; color: #22c55e; margin-bottom: 4px; }
                .cap-desc { font-size: 12px; color: #a0a0a0; }
                .cap-file { font-size: 10px; color: #666; margin-top: 6px; font-family: monospace; }
                
                .limitations-list { display: flex; flex-direction: column; gap: 10px; }
                .limitation-item {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 6px;
                    padding: 12px;
                }
                .lim-area { font-weight: 600; color: #ef4444; margin-bottom: 4px; }
                .lim-issue { font-size: 12px; color: #a0a0a0; }
                .lim-suggestion { font-size: 11px; color: #22c55e; margin-top: 8px; }
                
                .improvements-list { display: flex; flex-direction: column; gap: 10px; }
                .improvement-item {
                    background: rgba(59, 130, 246, 0.1);
                    border: 1px solid rgba(59, 130, 246, 0.2);
                    border-radius: 6px;
                    padding: 12px;
                    position: relative;
                }
                .imp-area { font-weight: 600; color: #3b82f6; margin-bottom: 4px; }
                .imp-suggestion { font-size: 12px; color: #a0a0a0; }
                .imp-priority {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    font-size: 9px;
                    padding: 2px 6px;
                    border-radius: 3px;
                    text-transform: uppercase;
                }
                .priority-high .imp-priority { background: #ef4444; color: white; }
                .priority-medium .imp-priority { background: #f59e0b; color: black; }
                .priority-low .imp-priority { background: #22c55e; color: white; }
                
                .health-display { text-align: center; padding: 16px; }
                .health-score {
                    font-size: 48px;
                    font-weight: 700;
                }
                .health-score.healthy { color: #22c55e; }
                .health-score.degraded { color: #f59e0b; }
                .health-score.critical { color: #ef4444; }
                .health-status { font-size: 14px; color: #888; margin-top: 4px; }
                .health-issues { margin-top: 12px; text-align: left; }
                .health-issue { font-size: 11px; color: #ef4444; margin: 4px 0; }
                
                .awareness-timestamp {
                    text-align: center;
                    font-size: 11px;
                    color: #555;
                    margin-top: 16px;
                }
                
                @media (max-width: 600px) {
                    .stats-grid { grid-template-columns: repeat(2, 1fr); }
                }
            </style>
        `;

        core.setDetail(this.id, html);
        core.setStatus(this.id, health.score >= 70 ? 'pass' : 'warn');
    }
});
