/**
 * investigation-package.js - Frontend Investigation UI
 * North Star Watchdog
 * 
 * Provides interactive investigation tools including:
 * - Entity search across 12 OSINT sources
 * - CCAP provider fraud pattern detection
 * - Political donation cross-reference
 * - One-click investigation packages
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const INVESTIGATION_CONFIG = {
    sources: {
        federal: [
            { id: 'propublica', name: 'ProPublica 990s', icon: '📄', description: 'Nonprofit tax filings' },
            { id: 'fec', name: 'FEC Campaign Finance', icon: '💰', description: 'Federal political donations' },
            { id: 'oig', name: 'OIG Exclusions', icon: '🏥', description: 'Healthcare ban list' },
            { id: 'usaspending', name: 'USASpending', icon: '🏛️', description: 'Federal grants & contracts' },
            { id: 'sec', name: 'SEC EDGAR', icon: '📊', description: 'Corporate filings' },
            { id: 'osha', name: 'OSHA', icon: '⚠️', description: 'Safety violations' },
            { id: 'fda', name: 'FDA', icon: '💊', description: 'Drug enforcement' },
            { id: 'hud', name: 'HUD', icon: '🏠', description: 'Housing awards' }
        ],
        minnesota: [
            { id: 'mncfb', name: 'MN Campaign Finance', icon: '🗳️', description: 'State political donations' },
            { id: 'mndhs', name: 'MN DHS Licensing', icon: '📋', description: 'Licensed providers' },
            { id: 'mntransparency', name: 'MN Transparency', icon: '🔍', description: 'State vendor payments' },
            { id: 'parentaware', name: 'ParentAware', icon: '👶', description: 'CCAP providers' }
        ],
        business: [
            { id: 'opencorporates', name: 'OpenCorporates', icon: '🏢', description: 'Business registrations' },
            { id: 'mnsos', name: 'MN Secretary of State', icon: '📜', description: 'MN business filings' }
        ]
    },
    fraudPatterns: {
        names: ['feeding our future', 'quality learning', 'quality learing', 'partners in nutrition', 'future leaders'],
        characteristics: ['Large CCAP payments + political donations', 'Licensed for 99+ children', 'Multiple locations, same ownership', 'Recently opened with high billing']
    }
};

// ============================================================================
// URL GENERATORS
// ============================================================================

const generateSearchUrls = (entityName, city = 'Minneapolis') => {
    const encoded = encodeURIComponent(entityName);
    const encodedCity = encodeURIComponent(city);
    
    return {
        proPublica: `https://projects.propublica.org/nonprofits/search?q=${encoded}`,
        fec: `https://www.fec.gov/data/receipts/individual-contributions/?contributor_name=${encoded}&contributor_state=MN`,
        fecCommittees: `https://www.fec.gov/data/committee/?q=${encoded}`,
        oig: 'https://exclusions.oig.hhs.gov/',
        usaSpending: `https://www.usaspending.gov/search/?hash=recipient/${encoded}`,
        sec: `https://www.sec.gov/cgi-bin/browse-edgar?company=${encoded}&CIK=&type=&owner=include&count=40&action=getcompany`,
        osha: `https://www.osha.gov/pls/imis/establishment.search?p_logger=1&establishment=${encoded}&State=MN`,
        mnCFB: `https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?ContributorName=${encoded}`,
        mnCFBRecipient: `https://cfb.mn.gov/reports-and-data/viewers/contribution-search/?RecipientName=${encoded}`,
        mnCFBData: 'https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/',
        mnLicensing: 'https://licensinglookup.dhs.state.mn.us/',
        mnTransparency: 'https://mn.gov/mmb/transparency-mn/',
        parentAware: `https://www.parentaware.org/find-care/?search=${encoded}`,
        mnSOS: 'https://mblsportal.sos.state.mn.us/Business/Search',
        openCorporates: `https://opencorporates.com/companies?q=${encoded}&jurisdiction_code=us_mn`,
        openSecrets: `https://www.opensecrets.org/search?q=${encoded}&type=donors`,
        googleNews: `https://news.google.com/search?q=${encoded}+${encodedCity}+fraud`,
        xTwitter: `https://twitter.com/search?q=${encoded}+Minnesota&f=live`,
        youtube: `https://www.youtube.com/results?search_query=${encoded}+Minnesota+fraud`
    };
};

// ============================================================================
// FRAUD PATTERN DETECTION
// ============================================================================

const detectFraudPatterns = (entityName) => {
    const patterns = [];
    const nameLower = entityName.toLowerCase();
    
    for (const pattern of INVESTIGATION_CONFIG.fraudPatterns.names) {
        if (nameLower.includes(pattern)) {
            patterns.push({ type: 'KNOWN_FRAUD_PATTERN', match: pattern, severity: 'HIGH', description: `Name matches known fraud pattern: "${pattern}"` });
        }
    }
    
    if (/learing|lerning/i.test(entityName)) {
        patterns.push({ type: 'MISSPELLING', severity: 'MEDIUM', description: 'Name contains misspelling - seen in known fraud case' });
    }
    
    if (/child\s*care|day\s*care|learning\s*center/i.test(entityName)) {
        patterns.push({ type: 'CHILDCARE_NAME', severity: 'INFO', description: 'Generic childcare name - verify licensing and activity' });
    }
    
    return patterns;
};

// ============================================================================
// INVESTIGATION PACKAGE UI
// ============================================================================

const createInvestigationPackageUI = (entityName, options = {}) => {
    const urls = generateSearchUrls(entityName, options.city);
    const patterns = detectFraudPatterns(entityName);
    
    const container = document.createElement('div');
    container.className = 'investigation-package';
    container.innerHTML = `
        <div class="investigation-header">
            <h3><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Investigation Package: ${entityName}</h3>
            <span class="investigation-timestamp">Generated: ${new Date().toLocaleString()}</span>
        </div>
        
        ${patterns.length > 0 ? `<div class="fraud-patterns-alert"><h4>⚠️ Fraud Pattern Alerts</h4>${patterns.map(p => `<div class="pattern-item pattern-${p.severity.toLowerCase()}"><span class="pattern-severity">${p.severity}</span><span class="pattern-desc">${p.description}</span></div>`).join('')}</div>` : ''}
        
        <div class="investigation-sections">
            <div class="investigation-section minnesota-section">
                <h4>🏛️ Minnesota Sources (CRITICAL for CCAP Fraud)</h4>
                <p class="section-desc">Cross-reference CCAP payments with political donations</p>
                <div class="source-links">
                    <a href="${urls.mnCFB}" target="_blank" rel="noopener" class="source-link priority"><span class="source-icon">🗳️</span><span class="source-name">MN Campaign Finance (Contributor)</span><span class="source-badge">CRITICAL</span></a>
                    <a href="${urls.mnCFBRecipient}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">🗳️</span><span class="source-name">MN Campaign Finance (Recipient)</span></a>
                    <a href="${urls.mnLicensing}" target="_blank" rel="noopener" class="source-link priority"><span class="source-icon">📋</span><span class="source-name">MN DHS Licensing Lookup</span><span class="source-badge">CRITICAL</span></a>
                    <a href="${urls.parentAware}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">👶</span><span class="source-name">ParentAware CCAP Search</span></a>
                    <a href="${urls.mnTransparency}" target="_blank" rel="noopener" class="source-link priority"><span class="source-icon">💵</span><span class="source-name">MN State Payments</span><span class="source-badge">CRITICAL</span></a>
                    <a href="${urls.mnSOS}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">📜</span><span class="source-name">MN Business Search</span></a>
                </div>
            </div>
            
            <div class="investigation-section federal-section">
                <h4>🇺🇸 Federal Sources</h4>
                <div class="source-links">
                    <a href="${urls.proPublica}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">📄</span><span class="source-name">ProPublica 990 Filings</span></a>
                    <a href="${urls.fec}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">💰</span><span class="source-name">FEC Individual Contributions</span></a>
                    <a href="${urls.usaSpending}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">🏛️</span><span class="source-name">USASpending Federal Awards</span></a>
                    <a href="${urls.oig}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">🏥</span><span class="source-name">OIG Exclusions List</span></a>
                    <a href="${urls.sec}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">📊</span><span class="source-name">SEC EDGAR Filings</span></a>
                    <a href="${urls.osha}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">⚠️</span><span class="source-name">OSHA Violations</span></a>
                </div>
            </div>
            
            <div class="investigation-section business-section">
                <h4>🏢 Business Records</h4>
                <div class="source-links">
                    <a href="${urls.openCorporates}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">🏢</span><span class="source-name">OpenCorporates (MN)</span></a>
                    <a href="${urls.openSecrets}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">🔎</span><span class="source-name">OpenSecrets Donor Search</span></a>
                </div>
            </div>
            
            <div class="investigation-section news-section">
                <h4>📰 News & Social Media</h4>
                <div class="source-links">
                    <a href="${urls.googleNews}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">📰</span><span class="source-name">Google News</span></a>
                    <a href="${urls.xTwitter}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">𝕏</span><span class="source-name">X/Twitter Search</span></a>
                    <a href="${urls.youtube}" target="_blank" rel="noopener" class="source-link"><span class="source-icon">▶️</span><span class="source-name">YouTube</span></a>
                </div>
            </div>
        </div>
        
        <div class="investigation-checklist">
            <h4>📋 Investigation Checklist</h4>
            <div class="checklist-items">
                <label class="checklist-item"><input type="checkbox"> Search MN Campaign Finance for political donations</label>
                <label class="checklist-item"><input type="checkbox"> Verify license status in MN DHS Licensing</label>
                <label class="checklist-item"><input type="checkbox"> Check MN Transparency for state payments received</label>
                <label class="checklist-item"><input type="checkbox"> Cross-reference CCAP payments with donation amounts</label>
                <label class="checklist-item"><input type="checkbox"> Verify physical location exists and is operational</label>
                <label class="checklist-item"><input type="checkbox"> Search ProPublica for 990 filings if nonprofit</label>
                <label class="checklist-item"><input type="checkbox"> Check FEC for federal political contributions</label>
                <label class="checklist-item"><input type="checkbox"> Review news coverage for fraud allegations</label>
                <label class="checklist-item"><input type="checkbox"> Document findings with screenshots</label>
            </div>
        </div>
        
        <div class="investigation-actions">
            <button class="btn-copy-links" onclick="copyInvestigationLinks('${entityName}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy All Links</button>
            <button class="btn-generate-report" onclick="generateInvestigationReport('${entityName}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Generate Report</button>
        </div>
    `;
    
    return container;
};

// ============================================================================
// COPY INVESTIGATION LINKS
// ============================================================================

window.copyInvestigationLinks = (entityName) => {
    const urls = generateSearchUrls(entityName);
    const text = `INVESTIGATION PACKAGE: ${entityName}
Generated: ${new Date().toLocaleString()}

=== MINNESOTA SOURCES (CRITICAL) ===
MN Campaign Finance: ${urls.mnCFB}
MN DHS Licensing: ${urls.mnLicensing}
MN State Payments: ${urls.mnTransparency}
ParentAware CCAP: ${urls.parentAware}
MN Business Search: ${urls.mnSOS}

=== FEDERAL SOURCES ===
ProPublica 990s: ${urls.proPublica}
FEC Contributions: ${urls.fec}
USASpending: ${urls.usaSpending}
OIG Exclusions: ${urls.oig}
SEC EDGAR: ${urls.sec}

=== BUSINESS RECORDS ===
OpenCorporates: ${urls.openCorporates}
OpenSecrets: ${urls.openSecrets}

=== NEWS & SOCIAL ===
Google News: ${urls.googleNews}
X/Twitter: ${urls.xTwitter}`;
    
    navigator.clipboard.writeText(text).then(() => alert('Investigation links copied!')).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Investigation links copied!');
    });
};

// ============================================================================
// GENERATE INVESTIGATION REPORT
// ============================================================================

window.generateInvestigationReport = (entityName) => {
    const urls = generateSearchUrls(entityName);
    const patterns = detectFraudPatterns(entityName);
    
    const report = `# Investigation Report: ${entityName}

**Generated:** ${new Date().toLocaleString()}
**Status:** PENDING INVESTIGATION

## Fraud Pattern Analysis
${patterns.length > 0 ? patterns.map(p => `- **${p.severity}**: ${p.description}`).join('\n') : '- No known fraud patterns detected'}

## Investigation Sources

### Minnesota Sources (Priority)
| Source | Status | Link |
|--------|--------|------|
| MN Campaign Finance | ⬜ Pending | [Search](${urls.mnCFB}) |
| MN DHS Licensing | ⬜ Pending | [Search](${urls.mnLicensing}) |
| MN State Payments | ⬜ Pending | [Search](${urls.mnTransparency}) |
| ParentAware CCAP | ⬜ Pending | [Search](${urls.parentAware}) |

### Federal Sources
| Source | Status | Link |
|--------|--------|------|
| ProPublica 990s | ⬜ Pending | [Search](${urls.proPublica}) |
| FEC Contributions | ⬜ Pending | [Search](${urls.fec}) |
| USASpending | ⬜ Pending | [Search](${urls.usaSpending}) |

## Key Questions
1. Is the provider currently licensed?
2. What is their licensed capacity vs. claimed enrollment?
3. How much CCAP funding have they received?
4. Are there political donations from this provider?
5. Is there a physical location with visible childcare activity?

---
*Report generated by North Star Watchdog*`;
    
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investigation-${entityName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ============================================================================
// QUICK INVESTIGATE
// ============================================================================

window.quickInvestigate = (entityName) => {
    const modal = document.createElement('div');
    modal.className = 'investigation-modal';
    modal.innerHTML = `
        <div class="investigation-modal-overlay" onclick="this.parentElement.remove()"></div>
        <div class="investigation-modal-content">
            <button class="investigation-modal-close" onclick="this.parentElement.parentElement.remove()">×</button>
            <div class="investigation-modal-body"></div>
        </div>
    `;
    
    modal.querySelector('.investigation-modal-body').appendChild(createInvestigationPackageUI(entityName));
    document.body.appendChild(modal);
};

// ============================================================================
// ENHANCE RED FLAG CARDS
// ============================================================================

const enhanceRedFlagCards = () => {
    document.querySelectorAll('.red-flag-card, .detective-card').forEach(card => {
        const entityName = card.querySelector('.entity-name, h4')?.textContent;
        if (entityName && !card.querySelector('.investigate-btn')) {
            const btn = document.createElement('button');
            btn.className = 'investigate-btn';
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg> Investigate`;
            btn.onclick = () => quickInvestigate(entityName);
            card.appendChild(btn);
        }
    });
};

// ============================================================================
// INJECT STYLES
// ============================================================================

const injectStyles = () => {
    if (document.getElementById('investigation-package-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'investigation-package-styles';
    styles.textContent = `
        .investigation-package { background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 24px; max-width: 800px; margin: 0 auto; }
        .investigation-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #333; }
        .investigation-header h3 { display: flex; align-items: center; gap: 10px; color: #d4af37; margin: 0; }
        .investigation-timestamp { color: #666; font-size: 12px; }
        .fraud-patterns-alert { background: rgba(220, 53, 69, 0.1); border: 1px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 16px; margin-bottom: 20px; }
        .fraud-patterns-alert h4 { color: #dc3545; margin: 0 0 12px 0; }
        .pattern-item { display: flex; align-items: center; gap: 10px; padding: 8px; margin: 4px 0; border-radius: 4px; }
        .pattern-item.pattern-high { background: rgba(220, 53, 69, 0.2); }
        .pattern-item.pattern-medium { background: rgba(255, 193, 7, 0.2); }
        .pattern-item.pattern-info { background: rgba(13, 110, 253, 0.2); }
        .pattern-severity { font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; }
        .pattern-high .pattern-severity { background: #dc3545; color: white; }
        .pattern-medium .pattern-severity { background: #ffc107; color: #000; }
        .pattern-info .pattern-severity { background: #0d6efd; color: white; }
        .investigation-section { margin-bottom: 20px; }
        .investigation-section h4 { color: #fff; margin: 0 0 8px 0; font-size: 14px; }
        .section-desc { color: #888; font-size: 12px; margin: 0 0 12px 0; }
        .minnesota-section { background: rgba(212, 175, 55, 0.1); border: 1px solid rgba(212, 175, 55, 0.3); border-radius: 8px; padding: 16px; }
        .source-links { display: flex; flex-direction: column; gap: 8px; }
        .source-link { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #252525; border: 1px solid #333; border-radius: 6px; color: #fff; text-decoration: none; transition: all 0.2s; }
        .source-link:hover { background: #333; border-color: #d4af37; }
        .source-link.priority { border-color: #d4af37; background: rgba(212, 175, 55, 0.1); }
        .source-icon { font-size: 18px; }
        .source-name { flex: 1; }
        .source-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; background: #d4af37; color: #000; font-weight: bold; }
        .investigation-checklist { background: #252525; border-radius: 8px; padding: 16px; margin-top: 20px; }
        .investigation-checklist h4 { color: #fff; margin: 0 0 12px 0; }
        .checklist-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; color: #ccc; cursor: pointer; }
        .checklist-item:hover { color: #fff; }
        .checklist-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: #d4af37; }
        .investigation-actions { display: flex; gap: 12px; margin-top: 20px; }
        .btn-copy-links, .btn-generate-report { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 6px; font-size: 14px; cursor: pointer; transition: all 0.2s; }
        .btn-copy-links { background: #333; border: 1px solid #444; color: #fff; }
        .btn-copy-links:hover { background: #444; }
        .btn-generate-report { background: #d4af37; border: none; color: #000; font-weight: 500; }
        .btn-generate-report:hover { background: #e5c04b; }
        .investigation-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 10000; display: flex; align-items: center; justify-content: center; }
        .investigation-modal-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); }
        .investigation-modal-content { position: relative; background: #1a1a1a; border-radius: 16px; max-width: 900px; max-height: 90vh; overflow-y: auto; margin: 20px; }
        .investigation-modal-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: #666; font-size: 24px; cursor: pointer; z-index: 1; }
        .investigation-modal-close:hover { color: #fff; }
        .investigate-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: rgba(212, 175, 55, 0.2); border: 1px solid #d4af37; border-radius: 4px; color: #d4af37; font-size: 12px; cursor: pointer; margin-top: 10px; transition: all 0.2s; }
        .investigate-btn:hover { background: #d4af37; color: #000; }
    `;
    
    document.head.appendChild(styles);
};

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    setTimeout(enhanceRedFlagCards, 1000);
    
    const observer = new MutationObserver(() => enhanceRedFlagCards());
    observer.observe(document.body, { childList: true, subtree: true });
});

// ============================================================================
// EXPORTS
// ============================================================================

window.InvestigationPackage = {
    create: createInvestigationPackageUI,
    generateUrls: generateSearchUrls,
    detectPatterns: detectFraudPatterns,
    quickInvestigate: quickInvestigate,
    copyLinks: copyInvestigationLinks,
    generateReport: generateInvestigationReport,
    config: INVESTIGATION_CONFIG
};
