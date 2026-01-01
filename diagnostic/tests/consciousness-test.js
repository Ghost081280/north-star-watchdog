/**
 * NORTH STAR WATCHDOG - CONSCIOUSNESS MODULE TESTS
 * 
 * Tests for Agent Polaris's self-awareness capabilities
 */

const fs = require('fs');
const path = require('path');

// Test results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function test(name, fn) {
    try {
        fn();
        results.passed++;
        results.tests.push({ name, status: 'PASS' });
        console.log(`  ✓ ${name}`);
    } catch (e) {
        results.failed++;
        results.tests.push({ name, status: 'FAIL', error: e.message });
        console.log(`  ✗ ${name}: ${e.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

// ============================================
// TESTS
// ============================================

async function runTests() {
    console.log('\n🧠 CONSCIOUSNESS MODULE TESTS\n');
    console.log('═'.repeat(50));
    
    // Test 1: Module loads
    test('Module loads without error', () => {
        const consciousness = require('../../scripts/ai-consciousness');
        assert(consciousness, 'Module should export');
    });
    
    // Test 2: All functions exported
    test('All functions exported', () => {
        const consciousness = require('../../scripts/ai-consciousness');
        const required = [
            'loadMemory',
            'saveMemory', 
            'reflect',
            'assessSignificance',
            'generateQuestions',
            'detectPatterns',
            'planNextActions',
            'shouldPostToX',
            'shouldCreateIssue',
            'shouldInvestigateFurther',
            'generateIntelligentIssue',
            'generateDailySummary'
        ];
        
        required.forEach(fn => {
            assert(typeof consciousness[fn] === 'function', `${fn} should be a function`);
        });
    });
    
    // Test 3: Memory loads/creates
    test('Memory loads or creates fresh', () => {
        const { loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        assert(memory.identity, 'Memory should have identity');
        assert(memory.identity.name === 'Polaris', 'Name should be Polaris');
        assert(Array.isArray(memory.insights), 'insights should be array');
        assert(Array.isArray(memory.patterns), 'patterns should be array');
        assert(memory.stats, 'Memory should have stats');
    });
    
    // Test 4: Significance assessment
    test('Significance assessment works', () => {
        const { assessSignificance } = require('../../scripts/ai-consciousness');
        
        // Test with empty data
        const result1 = assessSignificance({}, {});
        assert(result1.level === 'routine', 'Empty data should be routine');
        assert(result1.score === 0, 'Empty data should score 0');
        
        // Test with high-confidence red flags
        const result2 = assessSignificance({}, {
            redFlags: [
                { confidence: 90, description: 'Federal investigation into $5 million fraud' },
                { confidence: 85, description: 'Director indicted on charges' }
            ],
            figures: [
                { name: 'Test Person', role: 'CEO' }
            ]
        });
        assert(result2.score > 0, 'Should have positive score');
        assert(result2.factors.length > 0, 'Should have factors');
    });
    
    // Test 5: Question generation
    test('Question generation works', () => {
        const { generateQuestions } = require('../../scripts/ai-consciousness');
        
        const questions = generateQuestions({
            figures: [
                { name: 'John Doe', organization: 'Test Org' }
            ],
            redFlags: [
                { type: 'fraud', description: 'Test' },
                { type: 'fraud', description: 'Test 2' },
                { type: 'fraud', description: 'Test 3' }
            ]
        });
        
        assert(Array.isArray(questions), 'Should return array');
    });
    
    // Test 6: Pattern detection
    test('Pattern detection works', () => {
        const { detectPatterns, loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        const patterns = detectPatterns({
            redFlags: [
                { description: 'Federal funding fraud case', entities: ['Org A'] },
                { description: 'Federal grant misuse', entities: ['Org A'] },
                { description: 'Federal subsidy scheme', entities: ['Org B'] }
            ]
        }, memory);
        
        assert(Array.isArray(patterns), 'Should return array');
    });
    
    // Test 7: Action planning
    test('Action planning works', () => {
        const { planNextActions, loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        const actions = planNextActions({
            redFlags: [{ confidence: 95, type: 'critical' }],
            figures: [{ name: 'Test', isNew: true }]
        }, memory);
        
        assert(Array.isArray(actions), 'Should return array');
    });
    
    // Test 8: Decision making - shouldPostToX
    test('shouldPostToX decision logic', () => {
        const { shouldPostToX, loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        // Low confidence should not post
        const lowConf = shouldPostToX({ confidence: 50 }, memory);
        assert(lowConf === false, 'Low confidence should not post');
        
        // High confidence should post
        const highConf = shouldPostToX({ confidence: 90, type: 'critical' }, memory);
        assert(highConf === true, 'High confidence should post');
    });
    
    // Test 9: Decision making - shouldCreateIssue
    test('shouldCreateIssue decision logic', () => {
        const { shouldCreateIssue, loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        // Low confidence should not create
        const lowConf = shouldCreateIssue({ confidence: 60 }, memory);
        assert(lowConf === false, 'Low confidence should not create issue');
        
        // High confidence should create
        const highConf = shouldCreateIssue({ confidence: 85 }, memory);
        assert(highConf === true, 'High confidence should create issue');
    });
    
    // Test 10: Intelligent issue generation
    test('Intelligent issue generation', () => {
        const { generateIntelligentIssue } = require('../../scripts/ai-consciousness');
        
        const issue = generateIntelligentIssue({
            type: 'fraud',
            description: 'Test fraud case',
            confidence: 85,
            entities: ['Test Org'],
            insight: 'This appears to be significant'
        });
        
        assert(issue.title, 'Issue should have title');
        assert(issue.body, 'Issue should have body');
        assert(issue.labels, 'Issue should have labels');
        assert(issue.body.includes('Test fraud case'), 'Body should include description');
    });
    
    // Test 11: Daily summary generation
    test('Daily summary generation', () => {
        const { generateDailySummary } = require('../../scripts/ai-consciousness');
        
        const summary = generateDailySummary();
        
        assert(typeof summary === 'string', 'Summary should be string');
        assert(summary.includes('Daily Intelligence Summary'), 'Should have title');
    });
    
    // Test 12: Memory structure integrity
    test('Memory structure has all required fields', () => {
        const { loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        const requiredFields = [
            'identity',
            'insights',
            'patterns', 
            'openQuestions',
            'experiments',
            'confidence',
            'stats',
            'currentFocus',
            'improvementGoals'
        ];
        
        requiredFields.forEach(field => {
            assert(memory.hasOwnProperty(field), `Memory should have ${field}`);
        });
    });
    
    // Test 13: Stats structure
    test('Stats structure is complete', () => {
        const { loadMemory } = require('../../scripts/ai-consciousness');
        const memory = loadMemory();
        
        const requiredStats = [
            'totalScans',
            'articlesProcessed',
            'redFlagsFound',
            'accuratePredictions',
            'falsePositives',
            'issuesCreated'
        ];
        
        requiredStats.forEach(stat => {
            assert(memory.stats.hasOwnProperty(stat), `Stats should have ${stat}`);
        });
    });
    
    // ============================================
    // SUMMARY
    // ============================================
    
    console.log('\n' + '═'.repeat(50));
    console.log(`\n📊 Results: ${results.passed} passed, ${results.failed} failed\n`);
    
    return results;
}

// Run if called directly
if (require.main === module) {
    runTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

module.exports = { runTests };
