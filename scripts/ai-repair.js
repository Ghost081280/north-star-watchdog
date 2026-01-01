/**
 * NORTH STAR WATCHDOG - SELF-REPAIR MODULE
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MODULE: Auto-Repair System
 * ═══════════════════════════════════════════════════════════════
 * 
 * When I detect issues, I fix them automatically.
 * This module contains all repair functions.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// Validation constants
const BLOCKED_JOURNALISTS = ['nick shirley', 'rich mchugh', 'mario nawfal'];
const VALID_STATUSES = ['charged', 'convicted', 'sentenced', 'indicted'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function readJson(filename) {
    const filepath = path.join(DATA_DIR, filename);
    try {
        if (fs.existsSync(filepath)) {
            return { success: true, data: JSON.parse(fs.readFileSync(filepath, 'utf8')) };
        }
        return { success: false, error: 'File not found' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

function writeJson(filename, data) {
    const filepath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// ============================================
// REPAIR FUNCTIONS
// ============================================

/**
 * Remove red flags with blanket source attribution (all 6 sources)
 */
function repairBlanketSources() {
    try {
        const result = readJson('red-flags.json');
        if (!result.success) return { success: false, message: result.error };
        
        const data = result.data;
        const originalCount = data.flags?.length || 0;
        
        data.flags = (data.flags || []).filter(f => 
            !f.apisUsed || f.apisUsed.length < 6
        );
        
        const removed = originalCount - data.flags.length;
        
        if (removed > 0) {
            data.lastRepaired = new Date().toISOString();
            data.repairNote = `Removed ${removed} flags with blanket sources`;
            writeJson('red-flags.json', data);
        }
        
        return { success: true, message: `Removed ${removed} flags with blanket sources`, removed };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Remove journalists from Key Figures (they report on fraud, not commit it)
 */
function repairJournalistsInFigures() {
    try {
        const result = readJson('figures.json');
        if (!result.success) return { success: false, message: result.error };
        
        const data = result.data;
        const originalCount = data.people?.length || 0;
        
        data.people = (data.people || []).filter(p => 
            !BLOCKED_JOURNALISTS.some(j => (p.name || '').toLowerCase().includes(j))
        );
        
        const removed = originalCount - data.people.length;
        
        if (removed > 0) {
            data.lastRepaired = new Date().toISOString();
            writeJson('figures.json', data);
            console.log(`    ✓ Removed ${removed} journalists from figures`);
        }
        
        return { success: true, message: `Removed ${removed} journalists`, removed };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Remove figures without allegations
 */
function repairFiguresNoAllegations() {
    try {
        const result = readJson('figures.json');
        if (!result.success) return { success: false, message: result.error };
        
        const data = result.data;
        const originalCount = data.people?.length || 0;
        
        data.people = (data.people || []).filter(p => 
            p.allegations && p.allegations.length > 0
        );
        
        const removed = originalCount - data.people.length;
        
        if (removed > 0) {
            data.lastRepaired = new Date().toISOString();
            writeJson('figures.json', data);
            console.log(`    ✓ Removed ${removed} figures without allegations`);
        }
        
        return { success: true, message: `Removed ${removed} figures without allegations`, removed };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Remove figures with invalid status (not charged/convicted/indicted/sentenced)
 */
function repairInvalidStatus() {
    try {
        const result = readJson('figures.json');
        if (!result.success) return { success: false, message: result.error };
        
        const data = result.data;
        const originalCount = data.people?.length || 0;
        
        data.people = (data.people || []).filter(p => 
            p.status && VALID_STATUSES.includes(p.status.toLowerCase())
        );
        
        const removed = originalCount - data.people.length;
        
        if (removed > 0) {
            data.lastRepaired = new Date().toISOString();
            writeJson('figures.json', data);
            console.log(`    ✓ Removed ${removed} figures with invalid status`);
        }
        
        return { success: true, message: `Removed ${removed} figures with invalid status`, removed };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Remove investigations without valid source URLs
 */
function repairInvestigationsNoSource() {
    try {
        const result = readJson('investigations.json');
        if (!result.success) return { success: false, message: result.error };
        
        const data = result.data;
        const originalCount = data.cases?.length || 0;
        
        data.cases = (data.cases || []).filter(c => 
            c.sourceUrl && c.sourceUrl.startsWith('http')
        );
        
        const removed = originalCount - data.cases.length;
        
        if (removed > 0) {
            data.lastRepaired = new Date().toISOString();
            writeJson('investigations.json', data);
            console.log(`    ✓ Removed ${removed} investigations without sources`);
        }
        
        return { success: true, message: `Removed ${removed} investigations without sources`, removed };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Reset stats to verified baseline
 */
function repairStatsBaseline() {
    try {
        const result = readJson('stats.json');
        if (!result.success) return { success: false, message: result.error };
        
        const data = result.data;
        let repaired = false;
        
        // Verified baseline from U.S. Attorney Joe Thompson
        if (!data.charged || data.charged < 70) {
            data.charged = 70;
            repaired = true;
        }
        if (!data.convicted || data.convicted < 28) {
            data.convicted = 28;
            repaired = true;
        }
        if (!data.alleged || !data.alleged.includes('9')) {
            data.alleged = '$9B+';
            repaired = true;
        }
        if (!data.activeCases || data.activeCases < 5) {
            data.activeCases = 5;
            repaired = true;
        }
        
        // Ensure source is set
        data.source = data.source || 'U.S. Attorney Joe Thompson, Dec 2025';
        data.sourceUrl = data.sourceUrl || 'https://www.cbsnews.com/minnesota/news/billions-paid-out-by-medicaid-in-minnesota-may-be-fraudulent-us-attorney/';
        
        if (repaired) {
            data.lastRepaired = new Date().toISOString();
            writeJson('stats.json', data);
            console.log('    ✓ Reset stats to verified baseline');
        }
        
        return { success: true, message: repaired ? 'Reset stats to verified baseline' : 'Stats already correct' };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Fix corrupted JSON file by resetting to empty structure
 */
function repairCorruptedFile(filename) {
    const defaults = {
        'news.json': { articles: [], breaking: null, lastUpdated: new Date().toISOString() },
        'figures.json': { people: [], officials: [], organizations: [], lastUpdated: new Date().toISOString() },
        'investigations.json': { cases: [], oversight: [], lastUpdated: new Date().toISOString() },
        'red-flags.json': { flags: [], sourcesUsed: [], sourcesChecked: [], lastUpdated: new Date().toISOString() },
        'trending.json': { topics: [], lastUpdated: new Date().toISOString() },
        'story-ideas.json': { ideas: [], lastUpdated: new Date().toISOString() },
        'stats.json': { 
            charged: 70, 
            convicted: 28, 
            alleged: '$9B+', 
            activeCases: 5,
            source: 'U.S. Attorney Joe Thompson, Dec 2025',
            sourceUrl: 'https://www.cbsnews.com/minnesota/news/billions-paid-out-by-medicaid-in-minnesota-may-be-fraudulent-us-attorney/',
            briefing: 'Field report unavailable.',
            lastUpdated: new Date().toISOString()
        }
    };
    
    try {
        const defaultData = defaults[filename];
        if (!defaultData) {
            return { success: false, message: `No default structure for ${filename}` };
        }
        
        defaultData.repairedAt = new Date().toISOString();
        defaultData.repairReason = 'File was corrupted or invalid JSON';
        
        writeJson(filename, defaultData);
        console.log(`    ✓ Reset ${filename} to default structure`);
        
        return { success: true, message: `Reset ${filename} to default structure` };
    } catch (e) {
        return { success: false, message: e.message };
    }
}

/**
 * Master repair function - repairs an issue by ID
 */
function repairIssue(issue) {
    console.log(`  🔧 Repairing: ${issue.id}`);
    
    switch (issue.id) {
        case 'blanket-sources':
            return repairBlanketSources();
        case 'journalists-in-figures':
            return repairJournalistsInFigures();
        case 'figures-no-allegations':
            return repairFiguresNoAllegations();
        case 'invalid-status':
            return repairInvalidStatus();
        case 'investigations-no-source':
            return repairInvestigationsNoSource();
        case 'stats-below-baseline':
        case 'stats-alleged-wrong':
            return repairStatsBaseline();
        default:
            if (issue.id.startsWith('corrupted-')) {
                const filename = issue.id.replace('corrupted-', '');
                return repairCorruptedFile(filename);
            }
            return { success: false, message: 'No auto-fix available for this issue' };
    }
}

/**
 * Run all repairs for a list of issues
 */
function repairAll(issues) {
    const results = {
        attempted: 0,
        succeeded: 0,
        failed: 0,
        repairs: []
    };
    
    const fixableIssues = issues.filter(i => i.fixable);
    
    for (const issue of fixableIssues) {
        results.attempted++;
        const repair = repairIssue(issue);
        
        if (repair.success) {
            results.succeeded++;
            results.repairs.push({
                issue: issue.id,
                action: repair.message,
                success: true
            });
        } else {
            results.failed++;
            results.repairs.push({
                issue: issue.id,
                action: repair.message,
                success: false
            });
        }
    }
    
    return results;
}

module.exports = {
    repairIssue,
    repairAll,
    repairBlanketSources,
    repairJournalistsInFigures,
    repairFiguresNoAllegations,
    repairInvalidStatus,
    repairInvestigationsNoSource,
    repairStatsBaseline,
    repairCorruptedFile
};
