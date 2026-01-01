/**
 * TEST MODULE: Link Verification
 * Verifies all source URLs are valid and not 404s
 */

DiagnosticCore.registerTest({
    id: 'links',
    name: 'LINK VERIFICATION',
    description: 'Verifies source URLs are valid format (actual HTTP checks would require backend)',
    icon: '🔗',
    critical: false,
    
    async run(core) {
        core.log('Testing link verification...', 'info');
        let allPassed = true;
        let totalLinks = 0;
        let validLinks = 0;
        let invalidLinks = [];
        
        // CHECK: Investigation source URLs
        if (core.DATA.investigations?.cases) {
            core.DATA.investigations.cases.forEach(c => {
                totalLinks++;
                if (c.sourceUrl && c.sourceUrl.startsWith('http')) {
                    validLinks++;
                } else {
                    invalidLinks.push({ type: 'Investigation', name: c.name, url: c.sourceUrl || 'MISSING' });
                }
            });
        }
        
        // CHECK: Red flag source URLs
        if (core.DATA.redflags?.flags) {
            core.DATA.redflags.flags.forEach(f => {
                if (f.sourceUrl) {
                    totalLinks++;
                    if (f.sourceUrl.startsWith('http')) {
                        validLinks++;
                    } else {
                        invalidLinks.push({ type: 'Red Flag', name: f.type, url: f.sourceUrl });
                    }
                }
            });
        }
        
        // CHECK: News article links
        if (core.DATA.news?.articles) {
            core.DATA.news.articles.slice(0, 20).forEach(a => {
                totalLinks++;
                if (a.link && a.link.startsWith('http')) {
                    validLinks++;
                } else {
                    invalidLinks.push({ type: 'News', name: a.title?.substring(0, 30), url: a.link || 'MISSING' });
                }
            });
        }
        
        // CHECK: Stats source URL
        if (core.DATA.stats?.sourceUrl) {
            totalLinks++;
            if (core.DATA.stats.sourceUrl.startsWith('http')) {
                validLinks++;
            } else {
                invalidLinks.push({ type: 'Stats', name: 'Baseline source', url: core.DATA.stats.sourceUrl });
            }
        }
        
        const percentValid = totalLinks > 0 ? Math.round((validLinks / totalLinks) * 100) : 0;
        
        core.addTest(this.id, 'All links have valid URL format', invalidLinks.length === 0,
            `${validLinks}/${totalLinks} valid (${percentValid}%)`);
        
        core.addTest(this.id, 'Investigation sources valid', 
            !invalidLinks.some(l => l.type === 'Investigation'),
            invalidLinks.filter(l => l.type === 'Investigation').length + ' invalid');
        
        core.addTest(this.id, 'News article links valid',
            !invalidLinks.some(l => l.type === 'News'),
            invalidLinks.filter(l => l.type === 'News').length + ' invalid');
        
        if (invalidLinks.length > 0) {
            allPassed = false;
            core.addIssue('warning', 'Invalid URLs found', 'data/*.json',
                `${invalidLinks.length} links have invalid format`,
                'Ensure all sourceUrl fields start with http:// or https://');
        }
        
        // DISPLAY: Link summary
        let detailHtml = `
            <div class="data-grid">
                <div class="data-card ${percentValid === 100 ? 'success' : (percentValid > 80 ? 'warning' : 'error')}">
                    <div class="data-card-title">Valid Links</div>
                    <div class="data-card-value">${percentValid}%</div>
                    <div class="data-card-detail">${validLinks}/${totalLinks} total</div>
                </div>
                <div class="data-card ${invalidLinks.length === 0 ? 'success' : 'error'}">
                    <div class="data-card-title">Invalid Links</div>
                    <div class="data-card-value">${invalidLinks.length}</div>
                </div>
            </div>
        `;
        
        if (invalidLinks.length > 0) {
            detailHtml += `
                <div style="margin-top:15px;">
                    <div style="color:#ea868f; font-size:10px; margin-bottom:5px;">INVALID LINKS:</div>
                    <table>
                        <thead><tr><th>Type</th><th>Item</th><th>URL</th></tr></thead>
                        <tbody>
                            ${invalidLinks.slice(0, 10).map(l => `
                                <tr class="table-error">
                                    <td>${l.type}</td>
                                    <td>${core.escapeHtml(l.name || 'N/A')}</td>
                                    <td style="color:#ea868f">${core.escapeHtml(l.url)}</td>
                                </tr>
                            `).join('')}
                            ${invalidLinks.length > 10 ? `<tr><td colspan="3" style="color:#666">+${invalidLinks.length - 10} more</td></tr>` : ''}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'warn');
    }
});
