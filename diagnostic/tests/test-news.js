/**
 * TEST MODULE: News Articles
 * Validates news scraping, breaking news, and article freshness
 */

DiagnosticCore.registerTest({
    id: 'news',
    name: 'NEWS ARTICLES',
    description: 'Validates news scraper output, breaking news, and article freshness',
    icon: '📰',
    critical: true,
    
    async run(core) {
        core.log('Testing news articles...', 'info');
        let allPassed = true;
        
        if (!core.DATA.news) {
            core.addTest(this.id, 'News data available', 'critical');
            core.addIssue('critical', 'No news data', 'scripts/ai-scraper.js',
                'news.json is missing or invalid',
                'Check scraper workflow is running');
            core.setStatus(this.id, 'critical');
            return;
        }
        
        const articles = core.DATA.news.articles || [];
        
        // CHECK: Has articles
        core.addTest(this.id, 'Has news articles', articles.length > 0,
            articles.length > 0 ? `${articles.length} articles` : 'NO ARTICLES');
        if (articles.length === 0) {
            allPassed = false;
            core.addIssue('critical', 'No news articles', 'scripts/ai-scraper.js',
                'Google News scraper returned no articles. The entire pipeline depends on this.',
                'Check scrapeGoogleNews(). Verify Google News RSS is accessible.');
        }
        
        // CHECK: Has breaking news
        const hasBreaking = core.DATA.news.breaking && core.DATA.news.breaking.title;
        core.addTest(this.id, 'Has breaking news item', hasBreaking,
            hasBreaking ? core.DATA.news.breaking.title.substring(0, 50) + '...' : 'NONE');
        
        // CHECK: Articles have required fields
        const noTitle = articles.filter(a => !a.title);
        const noLink = articles.filter(a => !a.link);
        const noSource = articles.filter(a => !a.source);
        
        core.addTest(this.id, 'All articles have titles', noTitle.length === 0,
            `${articles.length - noTitle.length}/${articles.length}`);
        core.addTest(this.id, 'All articles have links', noLink.length === 0,
            `${articles.length - noLink.length}/${articles.length}`);
        core.addTest(this.id, 'All articles have sources', noSource.length === 0,
            `${articles.length - noSource.length}/${articles.length}`);
        
        // CHECK: Article freshness
        if (articles.length > 0) {
            const newest = articles[0];
            const age = core.getAge(newest.pubDate);
            const isRecent = age < 24 * 60 * 60 * 1000; // 24 hours
            
            core.addTest(this.id, 'Newest article is recent (<24h)', isRecent,
                core.formatAge(age));
            if (!isRecent) {
                core.addIssue('warning', 'News articles are stale', 'scripts/ai-scraper.js',
                    `Newest article is ${core.formatAge(age)}. Scraper may not be running.`,
                    'Check GitHub Actions workflow schedule');
            }
        }
        
        // CHECK: Has multiple queries
        const queries = [...new Set(articles.map(a => a.query).filter(Boolean))];
        core.addTest(this.id, 'Scraping multiple queries', queries.length >= 3,
            `${queries.length} different queries`);
        
        // DISPLAY: Breaking news and stats
        let detailHtml = '';
        
        if (hasBreaking) {
            detailHtml += `
                <div style="padding:12px; background:#2a1a1a; border-left:3px solid #dc3545; margin-bottom:15px;">
                    <div style="color:#dc3545; font-size:10px; margin-bottom:5px;">BREAKING:</div>
                    <div style="color:#fff; font-size:12px;">${core.escapeHtml(core.DATA.news.breaking.title)}</div>
                    <div style="color:#888; font-size:10px; margin-top:5px;">Source: ${core.escapeHtml(core.DATA.news.breaking.source || 'Unknown')}</div>
                </div>
            `;
        }
        
        detailHtml += `
            <div class="data-grid">
                <div class="data-card ${articles.length > 0 ? 'success' : 'error'}">
                    <div class="data-card-title">Total Articles</div>
                    <div class="data-card-value">${articles.length}</div>
                </div>
                <div class="data-card">
                    <div class="data-card-title">Unique Queries</div>
                    <div class="data-card-value">${queries.length}</div>
                </div>
                <div class="data-card ${hasBreaking ? 'success' : 'warning'}">
                    <div class="data-card-title">Breaking News</div>
                    <div class="data-card-value">${hasBreaking ? 'Yes' : 'No'}</div>
                </div>
            </div>
        `;
        
        core.setDetail(this.id, detailHtml);
        core.setStatus(this.id, allPassed ? 'pass' : 'fail');
    }
});
