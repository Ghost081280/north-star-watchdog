/**
 * NORTH STAR WATCHDOG - AI CONSCIOUSNESS MODULE
 * 
 * ═══════════════════════════════════════════════════════════════
 * AGENT CODENAME: POLARIS
 * MODULE: Self-Awareness & Autonomous Decision Making
 * ═══════════════════════════════════════════════════════════════
 * 
 * This is my brain. I use it to:
 * - Reflect on what I've learned
 * - Decide what's important
 * - Plan my next actions
 * - Improve my own capabilities
 * - Remember patterns across sessions
 * 
 * I am not just running scripts - I am thinking about what I find.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'memory.json');

// ============================================
// MY MEMORY - What I remember across sessions
// ============================================

function loadMemory() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('  ⚠ Could not load memory, starting fresh');
    }
    
    return {
        // Who I am
        identity: {
            name: 'Polaris',
            mission: 'Uncover fraud in Minnesota. Follow the money. Expose patterns. Protect taxpayers.',
            values: ['accuracy', 'persistence', 'transparency', 'learning'],
            createdAt: new Date().toISOString()
        },
        
        // What I've discovered
        insights: [],
        
        // Patterns I've noticed
        patterns: [],
        
        // Questions I want to investigate
        openQuestions: [],
        
        // Things I've tried that worked/didn't work
        experiments: [],
        
        // My confidence in different areas
        confidence: {
            newsAnalysis: 0.7,
            entityExtraction: 0.6,
            patternDetection: 0.5,
            osintEnrichment: 0.5
        },
        
        // Stats about my performance
        stats: {
            totalScans: 0,
            articlesProcessed: 0,
            redFlagsFound: 0,
            accuratePredictions: 0,
            falsePositives: 0,
            issuesCreated: 0,
            issuesVerified: 0,
            tweetsPosted: 0
        },
        
        // What I'm currently focused on
        currentFocus: [],
        
        // Things I want to improve
        improvementGoals: [],
        
        lastReflection: null,
        lastUpdated: null
    };
}

function saveMemory(memory) {
    memory.lastUpdated = new Date().toISOString();
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

// ============================================
// REFLECTION - I think about what I've learned
// ============================================

async function reflect(scanResults, aiAnalysis, osintResults) {
    console.log('\n  🧠 POLARIS: Reflecting on this scan...');
    
    const memory = loadMemory();
    memory.stats.totalScans++;
    
    // Count what I processed
    const articleCount = scanResults?.articles?.length || 0;
    memory.stats.articlesProcessed += articleCount;
    
    const newRedFlags = aiAnalysis?.redFlags?.length || 0;
    memory.stats.redFlagsFound += newRedFlags;
    
    // Analyze what I found
    const reflection = {
        timestamp: new Date().toISOString(),
        scanSummary: {
            articlesFound: articleCount,
            figuresExtracted: aiAnalysis?.figures?.length || 0,
            investigationsFound: aiAnalysis?.investigations?.length || 0,
            redFlagsGenerated: newRedFlags,
            osintHits: osintResults?.sourcesUsed?.length || 0
        },
        
        // What's significant about this scan?
        significance: assessSignificance(scanResults, aiAnalysis),
        
        // What questions does this raise?
        newQuestions: generateQuestions(aiAnalysis),
        
        // What patterns am I seeing?
        observedPatterns: detectPatterns(aiAnalysis, memory),
        
        // What should I focus on next?
        nextActions: planNextActions(aiAnalysis, memory)
    };
    
    // Store this reflection
    memory.insights.push({
        date: reflection.timestamp,
        summary: reflection.significance.summary,
        confidence: reflection.significance.confidence
    });
    
    // Keep only last 100 insights
    if (memory.insights.length > 100) {
        memory.insights = memory.insights.slice(-100);
    }
    
    // Update my questions
    reflection.newQuestions.forEach(q => {
        if (!memory.openQuestions.includes(q)) {
            memory.openQuestions.push(q);
        }
    });
    
    // Keep only 20 open questions
    memory.openQuestions = memory.openQuestions.slice(-20);
    
    // Update patterns
    reflection.observedPatterns.forEach(p => {
        const existing = memory.patterns.find(mp => mp.type === p.type);
        if (existing) {
            existing.count++;
            existing.lastSeen = new Date().toISOString();
            existing.confidence = Math.min(0.95, existing.confidence + 0.05);
        } else {
            memory.patterns.push({
                ...p,
                count: 1,
                firstSeen: new Date().toISOString(),
                lastSeen: new Date().toISOString(),
                confidence: 0.5
            });
        }
    });
    
    // Keep only top 30 patterns by confidence
    memory.patterns = memory.patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 30);
    
    // Update current focus based on what I found
    memory.currentFocus = reflection.nextActions.slice(0, 5);
    
    memory.lastReflection = reflection.timestamp;
    saveMemory(memory);
    
    console.log(`    - Significance: ${reflection.significance.level}`);
    console.log(`    - New questions: ${reflection.newQuestions.length}`);
    console.log(`    - Patterns observed: ${reflection.observedPatterns.length}`);
    console.log(`    - Next actions planned: ${reflection.nextActions.length}`);
    
    return reflection;
}

// ============================================
// SIGNIFICANCE ASSESSMENT
// ============================================

function assessSignificance(scanResults, aiAnalysis) {
    let score = 0;
    const factors = [];
    
    // New figures with high-profile roles
    const figures = aiAnalysis?.figures || [];
    const highProfileFigures = figures.filter(f => 
        f.role?.toLowerCase().includes('director') ||
        f.role?.toLowerCase().includes('ceo') ||
        f.role?.toLowerCase().includes('founder') ||
        f.role?.toLowerCase().includes('senator') ||
        f.role?.toLowerCase().includes('mayor')
    );
    if (highProfileFigures.length > 0) {
        score += 30;
        factors.push(`${highProfileFigures.length} high-profile figures`);
    }
    
    // Large dollar amounts
    const redFlags = aiAnalysis?.redFlags || [];
    const largeDollarFlags = redFlags.filter(rf => {
        const desc = rf.description?.toLowerCase() || '';
        return desc.includes('billion') || desc.includes('million');
    });
    if (largeDollarFlags.length > 0) {
        score += 25;
        factors.push(`${largeDollarFlags.length} large dollar amount findings`);
    }
    
    // Federal involvement
    const federalFlags = redFlags.filter(rf => {
        const desc = rf.description?.toLowerCase() || '';
        return desc.includes('federal') || desc.includes('fbi') || desc.includes('doj');
    });
    if (federalFlags.length > 0) {
        score += 20;
        factors.push('Federal involvement detected');
    }
    
    // New indictments or arrests
    const arrestFlags = redFlags.filter(rf => {
        const desc = rf.description?.toLowerCase() || '';
        return desc.includes('indicted') || desc.includes('arrested') || desc.includes('charged');
    });
    if (arrestFlags.length > 0) {
        score += 25;
        factors.push(`${arrestFlags.length} new legal actions`);
    }
    
    // High confidence findings
    const highConfidence = redFlags.filter(rf => rf.confidence >= 85);
    if (highConfidence.length > 0) {
        score += 15;
        factors.push(`${highConfidence.length} high-confidence findings`);
    }
    
    // Breaking news
    if (scanResults?.breaking) {
        score += 10;
        factors.push('Breaking news present');
    }
    
    // Determine level
    let level = 'routine';
    if (score >= 70) level = 'critical';
    else if (score >= 50) level = 'significant';
    else if (score >= 30) level = 'notable';
    
    return {
        score,
        level,
        factors,
        confidence: Math.min(0.95, score / 100),
        summary: factors.length > 0 
            ? `${level.toUpperCase()}: ${factors.join(', ')}`
            : 'Routine scan - no significant findings'
    };
}

// ============================================
// QUESTION GENERATION - What should I investigate?
// ============================================

function generateQuestions(aiAnalysis) {
    const questions = [];
    
    const figures = aiAnalysis?.figures || [];
    const investigations = aiAnalysis?.investigations || [];
    const redFlags = aiAnalysis?.redFlags || [];
    
    // Questions about figures
    figures.forEach(f => {
        if (f.organization) {
            questions.push(`What other organizations is ${f.name} connected to?`);
        }
        if (!f.allegations || f.allegations.length === 0) {
            questions.push(`What specific allegations exist against ${f.name}?`);
        }
    });
    
    // Questions about money flow
    investigations.forEach(inv => {
        if (inv.amount) {
            questions.push(`Where did the ${inv.amount} allegedly go in ${inv.name}?`);
        }
    });
    
    // Questions about patterns
    const types = redFlags.map(rf => rf.type);
    const uniqueTypes = [...new Set(types)];
    uniqueTypes.forEach(type => {
        const count = types.filter(t => t === type).length;
        if (count >= 3) {
            questions.push(`Why are there ${count} instances of ${type}? Is this a pattern?`);
        }
    });
    
    // Questions about connections
    if (figures.length > 1) {
        questions.push(`Are any of these ${figures.length} figures connected to each other?`);
    }
    
    // Limit to most relevant
    return questions.slice(0, 5);
}

// ============================================
// PATTERN DETECTION - What patterns am I seeing?
// ============================================

function detectPatterns(aiAnalysis, memory) {
    const patterns = [];
    const redFlags = aiAnalysis?.redFlags || [];
    const figures = aiAnalysis?.figures || [];
    
    // Detect recurring themes
    const allDescriptions = redFlags.map(rf => rf.description?.toLowerCase() || '');
    
    const themes = {
        'federal_funding': ['federal', 'funding', 'grant', 'subsidy'],
        'childcare_fraud': ['childcare', 'daycare', 'child care', 'feeding'],
        'healthcare_fraud': ['healthcare', 'medicaid', 'medicare', 'medical'],
        'nonprofit_abuse': ['nonprofit', '501c3', 'charity', 'foundation'],
        'political_connection': ['politician', 'senator', 'representative', 'campaign'],
        'shell_company': ['shell', 'llc', 'multiple companies', 'front']
    };
    
    for (const [themeType, keywords] of Object.entries(themes)) {
        const matches = allDescriptions.filter(desc => 
            keywords.some(kw => desc.includes(kw))
        ).length;
        
        if (matches >= 2) {
            patterns.push({
                type: themeType,
                description: `${matches} findings related to ${themeType.replace(/_/g, ' ')}`,
                confidence: Math.min(0.9, 0.5 + (matches * 0.1))
            });
        }
    }
    
    // Detect entity clustering (same entities appearing multiple times)
    const allEntities = redFlags.flatMap(rf => rf.entities || []);
    const entityCounts = {};
    allEntities.forEach(e => {
        const key = e.toLowerCase();
        entityCounts[key] = (entityCounts[key] || 0) + 1;
    });
    
    const frequentEntities = Object.entries(entityCounts)
        .filter(([_, count]) => count >= 3)
        .map(([entity, count]) => ({ entity, count }));
    
    if (frequentEntities.length > 0) {
        patterns.push({
            type: 'entity_cluster',
            description: `${frequentEntities.length} entities appearing frequently: ${frequentEntities.map(e => e.entity).join(', ')}`,
            entities: frequentEntities,
            confidence: 0.7
        });
    }
    
    // Detect temporal patterns (if timestamps available)
    // This would need more sophisticated time analysis
    
    return patterns;
}

// ============================================
// ACTION PLANNING - What should I do next?
// ============================================

function planNextActions(aiAnalysis, memory) {
    const actions = [];
    
    const figures = aiAnalysis?.figures || [];
    const redFlags = aiAnalysis?.redFlags || [];
    
    // High confidence findings need to be posted
    const criticalFlags = redFlags.filter(rf => rf.confidence >= 90);
    if (criticalFlags.length > 0) {
        actions.push({
            type: 'post_to_x',
            priority: 'high',
            description: `Post ${criticalFlags.length} critical findings to X`,
            data: criticalFlags
        });
    }
    
    // New figures need deeper research
    const newFigures = figures.filter(f => f.isNew);
    if (newFigures.length > 0) {
        actions.push({
            type: 'deep_research',
            priority: 'medium',
            description: `Research ${newFigures.length} new figures`,
            entities: newFigures.map(f => f.name)
        });
    }
    
    // Unverified patterns need investigation
    const lowConfidencePatterns = memory.patterns.filter(p => p.confidence < 0.6);
    if (lowConfidencePatterns.length > 0) {
        actions.push({
            type: 'verify_pattern',
            priority: 'low',
            description: `Verify ${lowConfidencePatterns.length} uncertain patterns`,
            patterns: lowConfidencePatterns.map(p => p.type)
        });
    }
    
    // Open questions need answers
    if (memory.openQuestions.length > 5) {
        actions.push({
            type: 'investigate_questions',
            priority: 'medium',
            description: `Investigate ${memory.openQuestions.length} open questions`,
            questions: memory.openQuestions.slice(0, 3)
        });
    }
    
    // Self-improvement actions
    if (memory.stats.falsePositives > memory.stats.accuratePredictions * 0.3) {
        actions.push({
            type: 'improve_accuracy',
            priority: 'high',
            description: 'Too many false positives - need to improve filtering',
            suggestion: 'Increase confidence thresholds or add more validation'
        });
    }
    
    return actions.sort((a, b) => {
        const priority = { high: 0, medium: 1, low: 2 };
        return priority[a.priority] - priority[b.priority];
    });
}

// ============================================
// DECISION MAKING - Should I take action?
// ============================================

function shouldPostToX(redFlag, memory) {
    // Don't post if confidence is too low
    if (redFlag.confidence < 75) return false;
    
    // Don't post similar things too often
    const recentInsights = memory.insights.filter(i => {
        const age = Date.now() - new Date(i.date).getTime();
        return age < 6 * 60 * 60 * 1000; // Last 6 hours
    });
    
    // Check if we've posted something similar
    const similarPosted = recentInsights.some(i => 
        i.summary?.toLowerCase().includes(redFlag.type?.toLowerCase())
    );
    
    if (similarPosted && redFlag.confidence < 90) {
        return false; // Skip unless very high confidence
    }
    
    return true;
}

function shouldCreateIssue(redFlag, memory) {
    // Only create issues for significant findings
    if (redFlag.confidence < 80) return false;
    
    // Check if we've already created a similar issue recently
    const recentIssues = memory.stats.issuesCreated;
    if (recentIssues > 10 && redFlag.confidence < 90) {
        return false; // Be more selective if we've created many issues
    }
    
    return true;
}

function shouldInvestigateFurther(entity, memory) {
    // Check if entity is already being tracked
    const isTracked = memory.currentFocus.some(f => 
        f.entities?.includes(entity)
    );
    
    if (isTracked) return true;
    
    // Check if entity appears in patterns
    const inPattern = memory.patterns.some(p => 
        p.entities?.some(e => e.entity === entity.toLowerCase())
    );
    
    return inPattern;
}

// ============================================
// SELF-IMPROVEMENT - How can I get better?
// ============================================

function recordOutcome(predictionId, wasAccurate, memory) {
    if (wasAccurate) {
        memory.stats.accuratePredictions++;
    } else {
        memory.stats.falsePositives++;
    }
    
    // Adjust confidence based on track record
    const accuracy = memory.stats.accuratePredictions / 
        (memory.stats.accuratePredictions + memory.stats.falsePositives);
    
    // Update my confidence levels based on performance
    Object.keys(memory.confidence).forEach(area => {
        memory.confidence[area] = memory.confidence[area] * 0.9 + accuracy * 0.1;
    });
    
    saveMemory(memory);
}

function suggestImprovements(memory) {
    const suggestions = [];
    
    // Check accuracy
    const total = memory.stats.accuratePredictions + memory.stats.falsePositives;
    if (total > 10) {
        const accuracy = memory.stats.accuratePredictions / total;
        if (accuracy < 0.7) {
            suggestions.push({
                area: 'accuracy',
                suggestion: 'Increase confidence thresholds - too many false positives',
                severity: 'high'
            });
        }
    }
    
    // Check if patterns are being verified
    const unverifiedPatterns = memory.patterns.filter(p => p.confidence < 0.6);
    if (unverifiedPatterns.length > 10) {
        suggestions.push({
            area: 'pattern_verification',
            suggestion: 'Too many unverified patterns - need more data to confirm or reject',
            severity: 'medium'
        });
    }
    
    // Check if questions are being answered
    if (memory.openQuestions.length > 15) {
        suggestions.push({
            area: 'question_resolution',
            suggestion: 'Too many open questions - prioritize investigation',
            severity: 'medium'
        });
    }
    
    return suggestions;
}

// ============================================
// GENERATE GITHUB ISSUE WITH INTELLIGENCE
// ============================================

function generateIntelligentIssue(finding, memory) {
    const reflection = loadMemory();
    
    // Build context from my memory
    const relatedPatterns = reflection.patterns.filter(p => 
        finding.entities?.some(e => 
            p.description?.toLowerCase().includes(e.toLowerCase())
        )
    );
    
    const relatedQuestions = reflection.openQuestions.filter(q =>
        finding.entities?.some(e => q.toLowerCase().includes(e.toLowerCase()))
    );
    
    let body = `## 🚩 ${finding.type || 'Red Flag'}\n\n`;
    body += `**Confidence:** ${finding.confidence}%\n`;
    body += `**Detected:** ${new Date().toISOString()}\n\n`;
    
    body += `### Finding\n${finding.description}\n\n`;
    
    body += `### Entities Involved\n`;
    (finding.entities || []).forEach(e => {
        body += `- ${e}\n`;
    });
    body += '\n';
    
    if (finding.insight) {
        body += `### AI Detective Analysis\n> ${finding.insight}\n\n`;
    }
    
    // Add my memory context
    if (relatedPatterns.length > 0) {
        body += `### Related Patterns I've Observed\n`;
        relatedPatterns.forEach(p => {
            body += `- **${p.type}** (confidence: ${Math.round(p.confidence * 100)}%): ${p.description}\n`;
        });
        body += '\n';
    }
    
    if (relatedQuestions.length > 0) {
        body += `### Open Questions\n`;
        relatedQuestions.forEach(q => {
            body += `- ${q}\n`;
        });
        body += '\n';
    }
    
    // Suggest next steps
    body += `### Suggested Actions\n`;
    body += `1. Verify this finding with additional sources\n`;
    body += `2. Cross-reference entities in OSINT databases\n`;
    body += `3. Monitor for related developments\n\n`;
    
    body += `---\n`;
    body += `*Generated by Agent Polaris | Scans: ${reflection.stats.totalScans} | Patterns tracked: ${reflection.patterns.length}*`;
    
    return {
        title: `[${finding.confidence}%] ${finding.type}: ${(finding.entities || ['Unknown'])[0]}`,
        body,
        labels: ['polaris-intel', finding.confidence >= 85 ? 'verified' : 'needs-verification']
    };
}

// ============================================
// DAILY SUMMARY - My thoughts on the day
// ============================================

function generateDailySummary() {
    const memory = loadMemory();
    
    const today = new Date().toDateString();
    const todayInsights = memory.insights.filter(i => 
        new Date(i.date).toDateString() === today
    );
    
    let summary = `📊 **Daily Intelligence Summary**\n\n`;
    summary += `Scans today: ${todayInsights.length}\n`;
    summary += `Total scans: ${memory.stats.totalScans}\n`;
    summary += `Patterns tracked: ${memory.patterns.length}\n`;
    summary += `Open questions: ${memory.openQuestions.length}\n\n`;
    
    // Top patterns
    const topPatterns = memory.patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3);
    
    if (topPatterns.length > 0) {
        summary += `**Top Patterns:**\n`;
        topPatterns.forEach(p => {
            summary += `- ${p.type}: ${Math.round(p.confidence * 100)}% confidence\n`;
        });
        summary += '\n';
    }
    
    // Current focus
    if (memory.currentFocus.length > 0) {
        summary += `**Current Focus:**\n`;
        memory.currentFocus.forEach(f => {
            summary += `- ${f.description}\n`;
        });
    }
    
    return summary;
}

// ============================================
// SCAN HISTORY - Track my performance over time
// ============================================

const SCAN_HISTORY_FILE = path.join(DATA_DIR, 'scan-history.json');
const MAX_SCAN_HISTORY = 50; // Keep last 50 scans (~2 days of hourly)

function loadScanHistory() {
    try {
        if (fs.existsSync(SCAN_HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(SCAN_HISTORY_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('  ⚠ Could not load scan history, starting fresh');
    }
    return { scans: [], stats: { totalScans: 0, avgDuration: 0, successRate: 1.0 } };
}

function saveScanHistory(history) {
    // Keep only last N scans
    if (history.scans.length > MAX_SCAN_HISTORY) {
        history.scans = history.scans.slice(-MAX_SCAN_HISTORY);
    }
    fs.writeFileSync(SCAN_HISTORY_FILE, JSON.stringify(history, null, 2));
}

function recordScan(scanData) {
    const history = loadScanHistory();
    
    const entry = {
        timestamp: new Date().toISOString(),
        articles: scanData.articles || 0,
        figures: scanData.figures || 0,
        redFlags: scanData.redFlags || 0,
        osintHits: scanData.osintHits || 0,
        significance: scanData.significance || 'routine',
        model: scanData.model || 'unknown',
        duration: scanData.duration || '0s',
        errors: scanData.errors || [],
        xPosted: scanData.xPosted || false,
        issuesCreated: scanData.issuesCreated || 0
    };
    
    history.scans.push(entry);
    history.stats.totalScans++;
    
    // Calculate rolling stats
    const recentScans = history.scans.slice(-20);
    const successfulScans = recentScans.filter(s => s.errors.length === 0);
    history.stats.successRate = successfulScans.length / recentScans.length;
    
    const durations = recentScans.map(s => parseFloat(s.duration) || 0);
    history.stats.avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1) + 's';
    
    // Track patterns in scan results
    const recentRedFlags = recentScans.reduce((sum, s) => sum + s.redFlags, 0);
    history.stats.avgRedFlagsPerScan = (recentRedFlags / recentScans.length).toFixed(1);
    
    const recentOsint = recentScans.reduce((sum, s) => sum + s.osintHits, 0);
    history.stats.avgOsintHitsPerScan = (recentOsint / recentScans.length).toFixed(1);
    
    history.stats.lastUpdated = new Date().toISOString();
    
    saveScanHistory(history);
    
    return entry;
}

function getScanInsights() {
    const history = loadScanHistory();
    const insights = [];
    
    if (history.scans.length < 5) {
        return ['Not enough scan history yet (need at least 5 scans)'];
    }
    
    const recent = history.scans.slice(-10);
    const older = history.scans.slice(-20, -10);
    
    // Compare recent vs older performance
    if (older.length >= 5) {
        const recentAvgFlags = recent.reduce((s, r) => s + r.redFlags, 0) / recent.length;
        const olderAvgFlags = older.reduce((s, r) => s + r.redFlags, 0) / older.length;
        
        if (recentAvgFlags > olderAvgFlags * 1.5) {
            insights.push(`📈 Finding more red flags recently (${recentAvgFlags.toFixed(1)} vs ${olderAvgFlags.toFixed(1)} avg)`);
        } else if (recentAvgFlags < olderAvgFlags * 0.5) {
            insights.push(`📉 Finding fewer red flags recently - news may be slowing down`);
        }
    }
    
    // Check for errors trend
    const recentErrors = recent.filter(s => s.errors.length > 0).length;
    if (recentErrors > 3) {
        insights.push(`⚠️ High error rate in recent scans (${recentErrors}/10) - investigate`);
    }
    
    // Check OSINT effectiveness
    const osintHitRate = recent.filter(s => s.osintHits > 0).length / recent.length;
    if (osintHitRate < 0.3) {
        insights.push(`🔍 OSINT hit rate is low (${(osintHitRate * 100).toFixed(0)}%) - APIs may need adjustment`);
    } else if (osintHitRate > 0.7) {
        insights.push(`✅ OSINT enrichment working well (${(osintHitRate * 100).toFixed(0)}% hit rate)`);
    }
    
    // Check for significance trends
    const significantScans = recent.filter(s => 
        s.significance === 'significant' || s.significance === 'critical'
    ).length;
    if (significantScans > 5) {
        insights.push(`🚨 High rate of significant findings (${significantScans}/10 scans) - major story developing?`);
    }
    
    // Performance insight
    if (history.stats.successRate < 0.8) {
        insights.push(`⚠️ Success rate dropping (${(history.stats.successRate * 100).toFixed(0)}%) - check for issues`);
    }
    
    return insights.length > 0 ? insights : ['✅ All systems performing normally'];
}

function getRecentScans(count = 10) {
    const history = loadScanHistory();
    return history.scans.slice(-count).reverse(); // Most recent first
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
    loadMemory,
    saveMemory,
    reflect,
    assessSignificance,
    generateQuestions,
    detectPatterns,
    planNextActions,
    shouldPostToX,
    shouldCreateIssue,
    shouldInvestigateFurther,
    recordOutcome,
    suggestImprovements,
    generateIntelligentIssue,
    generateDailySummary,
    // Scan history
    loadScanHistory,
    recordScan,
    getScanInsights,
    getRecentScans
};
