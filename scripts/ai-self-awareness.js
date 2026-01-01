/**
 * AI SELF-AWARENESS MODULE
 * ========================
 * This module allows Agent Polaris to read and understand its entire codebase,
 * enabling true self-reflection and intelligent self-improvement.
 * 
 * "To improve oneself, one must first know oneself." - Agent Polaris
 */

const fs = require('fs');
const path = require('path');

class AISelfAwareness {
    constructor() {
        this.codebase = {};
        this.dataFiles = {};
        this.capabilities = [];
        this.limitations = [];
        this.improvements = [];
        this.connections = {};
    }

    /**
     * Read and catalog the entire codebase
     */
    async scanEntireCodebase() {
        console.log('\n🧠 POLARIS SELF-AWARENESS: Scanning my own codebase...\n');
        
        const rootDir = path.join(__dirname, '..');
        
        // Define what to scan
        const scanTargets = {
            scripts: {
                path: path.join(rootDir, 'scripts'),
                description: 'My brain - core AI logic and processing'
            },
            app: {
                path: path.join(rootDir, 'app'),
                description: 'My face - frontend rendering and user interaction'
            },
            data: {
                path: path.join(rootDir, 'data'),
                description: 'My memory - stored knowledge and findings'
            },
            diagnostic: {
                path: path.join(rootDir, 'diagnostic'),
                description: 'My health monitor - self-diagnostic systems'
            },
            js: {
                path: path.join(rootDir, 'js'),
                description: 'My tools - investigation utilities'
            },
            workflows: {
                path: path.join(rootDir, '.github/workflows'),
                description: 'My heartbeat - automated scheduling'
            }
        };

        for (const [name, target] of Object.entries(scanTargets)) {
            if (fs.existsSync(target.path)) {
                console.log(`📂 Scanning ${name}: ${target.description}`);
                this.codebase[name] = await this.scanDirectory(target.path, target.description);
            }
        }

        // Also scan root files
        const rootFiles = ['index.html', 'styles.css', 'README.md'];
        this.codebase.root = {};
        for (const file of rootFiles) {
            const filePath = path.join(rootDir, file);
            if (fs.existsSync(filePath)) {
                this.codebase.root[file] = await this.analyzeFile(filePath);
            }
        }

        return this.codebase;
    }

    /**
     * Scan a directory and analyze all files
     */
    async scanDirectory(dirPath, description) {
        const result = {
            description,
            files: {},
            summary: {}
        };

        if (!fs.existsSync(dirPath)) return result;

        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stat = fs.statSync(itemPath);
            
            if (stat.isFile()) {
                result.files[item] = await this.analyzeFile(itemPath);
            } else if (stat.isDirectory() && item !== 'node_modules') {
                // Recursively scan subdirectories
                result.files[item] = await this.scanDirectory(itemPath, `Subdirectory: ${item}`);
            }
        }

        return result;
    }

    /**
     * Analyze a single file - extract purpose, functions, dependencies
     */
    async analyzeFile(filePath) {
        const ext = path.extname(filePath);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        
        const analysis = {
            path: filePath,
            size: content.length,
            lines: lines.length,
            type: ext,
            lastModified: fs.statSync(filePath).mtime
        };

        // Analyze based on file type
        if (ext === '.js') {
            analysis.functions = this.extractFunctions(content);
            analysis.exports = this.extractExports(content);
            analysis.requires = this.extractRequires(content);
            analysis.purpose = this.extractPurpose(content);
            analysis.todos = this.extractTodos(content);
        } else if (ext === '.json') {
            try {
                const data = JSON.parse(content);
                analysis.structure = this.analyzeJsonStructure(data);
                analysis.recordCount = this.countRecords(data);
            } catch (e) {
                analysis.error = 'Invalid JSON';
            }
        } else if (ext === '.html') {
            analysis.sections = this.extractHtmlSections(content);
            analysis.scripts = this.extractScriptTags(content);
        } else if (ext === '.css') {
            analysis.ruleCount = (content.match(/\{/g) || []).length;
            analysis.variables = this.extractCssVariables(content);
        } else if (ext === '.yml' || ext === '.yaml') {
            analysis.purpose = 'GitHub Actions workflow';
            analysis.triggers = this.extractYamlTriggers(content);
        }

        return analysis;
    }

    /**
     * Extract function definitions from JS
     */
    extractFunctions(content) {
        const functions = [];
        
        // Match function declarations
        const funcRegex = /(?:async\s+)?function\s+(\w+)\s*\(/g;
        let match;
        while ((match = funcRegex.exec(content)) !== null) {
            functions.push(match[1]);
        }
        
        // Match arrow functions assigned to variables
        const arrowRegex = /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g;
        while ((match = arrowRegex.exec(content)) !== null) {
            functions.push(match[1]);
        }
        
        // Match class methods
        const methodRegex = /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm;
        while ((match = methodRegex.exec(content)) !== null) {
            if (!['if', 'for', 'while', 'switch', 'catch'].includes(match[1])) {
                functions.push(match[1]);
            }
        }
        
        return [...new Set(functions)];
    }

    /**
     * Extract module exports
     */
    extractExports(content) {
        const exports = [];
        
        const exportRegex = /module\.exports\s*=\s*\{?\s*([^}]+)\}?|exports\.(\w+)/g;
        let match;
        while ((match = exportRegex.exec(content)) !== null) {
            if (match[1]) exports.push(...match[1].split(',').map(s => s.trim()));
            if (match[2]) exports.push(match[2]);
        }
        
        return exports.filter(e => e && !e.includes('='));
    }

    /**
     * Extract require statements
     */
    extractRequires(content) {
        const requires = [];
        
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        let match;
        while ((match = requireRegex.exec(content)) !== null) {
            requires.push(match[1]);
        }
        
        return requires;
    }

    /**
     * Extract file purpose from comments
     */
    extractPurpose(content) {
        // Look for file header comments
        const headerMatch = content.match(/\/\*\*?\s*\n?\s*\*?\s*([^\n*]+)/);
        if (headerMatch) return headerMatch[1].trim();
        
        // Look for single line comment at top
        const lineMatch = content.match(/^\/\/\s*(.+)/);
        if (lineMatch) return lineMatch[1].trim();
        
        return 'No description found';
    }

    /**
     * Extract TODO comments
     */
    extractTodos(content) {
        const todos = [];
        const todoRegex = /\/\/\s*TODO:?\s*(.+)|\/\*\s*TODO:?\s*(.+)\*\//gi;
        let match;
        while ((match = todoRegex.exec(content)) !== null) {
            todos.push(match[1] || match[2]);
        }
        return todos;
    }

    /**
     * Analyze JSON structure
     */
    analyzeJsonStructure(data) {
        if (Array.isArray(data)) {
            return {
                type: 'array',
                length: data.length,
                sampleKeys: data[0] ? Object.keys(data[0]) : []
            };
        } else if (typeof data === 'object') {
            return {
                type: 'object',
                keys: Object.keys(data),
                nested: Object.keys(data).filter(k => typeof data[k] === 'object')
            };
        }
        return { type: typeof data };
    }

    /**
     * Count records in JSON data
     */
    countRecords(data) {
        if (Array.isArray(data)) return data.length;
        
        let count = 0;
        for (const key of Object.keys(data)) {
            if (Array.isArray(data[key])) {
                count += data[key].length;
            }
        }
        return count || Object.keys(data).length;
    }

    /**
     * Extract HTML sections
     */
    extractHtmlSections(content) {
        const sections = [];
        const sectionRegex = /<section[^>]*id="([^"]+)"/g;
        let match;
        while ((match = sectionRegex.exec(content)) !== null) {
            sections.push(match[1]);
        }
        return sections;
    }

    /**
     * Extract script tags
     */
    extractScriptTags(content) {
        const scripts = [];
        const scriptRegex = /<script[^>]*src="([^"]+)"/g;
        let match;
        while ((match = scriptRegex.exec(content)) !== null) {
            scripts.push(match[1]);
        }
        return scripts;
    }

    /**
     * Extract CSS variables
     */
    extractCssVariables(content) {
        const vars = [];
        const varRegex = /--([a-zA-Z0-9-]+)\s*:/g;
        let match;
        while ((match = varRegex.exec(content)) !== null) {
            vars.push(match[1]);
        }
        return [...new Set(vars)];
    }

    /**
     * Extract YAML triggers
     */
    extractYamlTriggers(content) {
        const triggers = [];
        if (content.includes('schedule:')) triggers.push('scheduled');
        if (content.includes('push:')) triggers.push('push');
        if (content.includes('workflow_dispatch:')) triggers.push('manual');
        if (content.includes('pull_request:')) triggers.push('pull_request');
        return triggers;
    }

    /**
     * Map connections between files
     */
    mapConnections() {
        console.log('\n🔗 Mapping connections between components...\n');
        
        this.connections = {
            dataFlow: [],
            dependencies: [],
            renderChain: []
        };

        // Map data flow: scripts -> data -> app
        this.connections.dataFlow = [
            { from: 'ai-scraper.js', to: 'news.json', type: 'writes' },
            { from: 'ai-analyzer.js', to: 'figures.json', type: 'writes' },
            { from: 'ai-analyzer.js', to: 'investigations.json', type: 'writes' },
            { from: 'ai-analyzer.js', to: 'trending.json', type: 'writes' },
            { from: 'ai-analyzer.js', to: 'story-ideas.json', type: 'writes' },
            { from: 'ai-osint.js', to: 'red-flags.json', type: 'writes' },
            { from: 'ai-files.js', to: 'stats.json', type: 'writes' },
            { from: 'ai-consciousness.js', to: 'memory.json', type: 'writes' },
            { from: 'app-core.js', to: '*.json', type: 'reads' },
            { from: 'app-render.js', to: 'DOM', type: 'renders' }
        ];

        // Map script dependencies
        if (this.codebase.scripts?.files) {
            for (const [filename, analysis] of Object.entries(this.codebase.scripts.files)) {
                if (analysis.requires) {
                    for (const req of analysis.requires) {
                        if (req.startsWith('./')) {
                            this.connections.dependencies.push({
                                from: filename,
                                to: req.replace('./', ''),
                                type: 'requires'
                            });
                        }
                    }
                }
            }
        }

        return this.connections;
    }

    /**
     * Identify capabilities based on codebase analysis
     */
    identifyCapabilities() {
        console.log('\n💪 Identifying my capabilities...\n');
        
        this.capabilities = [];

        // Check for specific capabilities
        if (this.codebase.scripts?.files?.['ai-scraper.js']) {
            this.capabilities.push({
                name: 'News Scraping',
                description: 'Can scrape Google News RSS for Minnesota fraud articles',
                file: 'ai-scraper.js'
            });
        }

        if (this.codebase.scripts?.files?.['ai-analyzer.js']) {
            this.capabilities.push({
                name: 'AI Analysis',
                description: 'Can use GROQ LLM to analyze news and extract entities',
                file: 'ai-analyzer.js'
            });
        }

        if (this.codebase.scripts?.files?.['ai-osint.js']) {
            this.capabilities.push({
                name: 'OSINT Enrichment',
                description: 'Can query 13 OSINT APIs for entity enrichment',
                file: 'ai-osint.js',
                sources: ['ProPublica', 'FEC', 'OIG', 'USASpending', 'OpenCorporates', 
                         'SEC', 'OSHA', 'FDA', 'HUD', 'MN Campaign Finance', 
                         'MN DHS Licensing', 'MN Transparency']
            });
        }

        if (this.codebase.scripts?.files?.['ai-consciousness.js']) {
            this.capabilities.push({
                name: 'Self-Reflection',
                description: 'Can reflect on scan results and maintain memory',
                file: 'ai-consciousness.js'
            });
        }

        if (this.codebase.scripts?.files?.['ai-diagnostic.js']) {
            this.capabilities.push({
                name: 'Self-Healing',
                description: 'Can detect and fix issues in data files',
                file: 'ai-diagnostic.js'
            });
        }

        if (this.codebase.scripts?.files?.['ai-twitter.js']) {
            this.capabilities.push({
                name: 'Social Media',
                description: 'Can post findings to X/Twitter',
                file: 'ai-twitter.js'
            });
        }

        if (this.codebase.app?.files?.['app-search.js']) {
            this.capabilities.push({
                name: 'Live Search',
                description: 'Can search multiple APIs in real-time for users',
                file: 'app-search.js'
            });
        }

        if (this.codebase.app?.files?.['app-research.js']) {
            this.capabilities.push({
                name: 'Deep Research',
                description: 'Can compile comprehensive research packages',
                file: 'app-research.js'
            });
        }

        return this.capabilities;
    }

    /**
     * Identify limitations and improvement opportunities
     */
    identifyLimitations() {
        console.log('\n⚠️ Identifying my limitations...\n');
        
        this.limitations = [];
        this.improvements = [];

        // Check GROQ rate limits
        this.limitations.push({
            area: 'AI Analysis',
            issue: 'GROQ rate limits causing analysis failures',
            impact: 'Trending topics and story ideas not being generated',
            suggestion: 'Reduce token count or upgrade GROQ tier'
        });

        // Check data freshness
        if (this.codebase.data?.files) {
            const dataFiles = Object.keys(this.codebase.data.files);
            if (dataFiles.length < 8) {
                this.limitations.push({
                    area: 'Data Coverage',
                    issue: 'Some expected data files may be missing',
                    impact: 'Incomplete information displayed to users'
                });
            }
        }

        // Check for missing connections
        if (!this.codebase.scripts?.files?.['ai-minnesota.js']) {
            this.improvements.push({
                area: 'Minnesota Focus',
                suggestion: 'Add dedicated Minnesota source module',
                priority: 'high'
            });
        }

        // Suggest improvements based on analysis
        this.improvements.push({
            area: 'Self-Learning',
            suggestion: 'Expand learning.json to track more entity types',
            priority: 'medium'
        });

        this.improvements.push({
            area: 'User Experience',
            suggestion: 'Add more interactive visualizations of fraud networks',
            priority: 'low'
        });

        return { limitations: this.limitations, improvements: this.improvements };
    }

    /**
     * Generate a comprehensive self-report
     */
    generateSelfReport() {
        console.log('\n📋 Generating self-awareness report...\n');
        
        const report = {
            timestamp: new Date().toISOString(),
            identity: {
                name: 'Agent Polaris',
                purpose: 'AI-powered Minnesota fraud investigation assistant',
                version: '5.0'
            },
            codebaseStats: {
                totalFiles: this.countTotalFiles(),
                scriptFiles: Object.keys(this.codebase.scripts?.files || {}).length,
                dataFiles: Object.keys(this.codebase.data?.files || {}).length,
                frontendFiles: Object.keys(this.codebase.app?.files || {}).length
            },
            capabilities: this.capabilities,
            limitations: this.limitations,
            improvements: this.improvements,
            connections: this.connections,
            health: this.assessHealth()
        };

        return report;
    }

    /**
     * Count total files in codebase
     */
    countTotalFiles() {
        let count = 0;
        const countInObj = (obj) => {
            if (!obj) return;
            if (obj.files) {
                count += Object.keys(obj.files).length;
                for (const file of Object.values(obj.files)) {
                    if (file.files) countInObj(file);
                }
            }
        };
        
        for (const section of Object.values(this.codebase)) {
            countInObj(section);
        }
        return count;
    }

    /**
     * Assess overall health
     */
    assessHealth() {
        let score = 100;
        const issues = [];

        // Check for critical files
        const criticalFiles = ['ai-core.js', 'ai-analyzer.js', 'ai-osint.js'];
        for (const file of criticalFiles) {
            if (!this.codebase.scripts?.files?.[file]) {
                score -= 20;
                issues.push(`Missing critical file: ${file}`);
            }
        }

        // Check for data files
        const requiredData = ['news.json', 'stats.json', 'figures.json'];
        for (const file of requiredData) {
            if (!this.codebase.data?.files?.[file]) {
                score -= 10;
                issues.push(`Missing data file: ${file}`);
            }
        }

        // Check limitations impact
        score -= this.limitations.length * 5;

        return {
            score: Math.max(0, score),
            status: score >= 80 ? 'healthy' : score >= 50 ? 'degraded' : 'critical',
            issues
        };
    }

    /**
     * Save self-awareness report for consciousness module to use
     */
    async saveReport(report) {
        const reportPath = path.join(__dirname, '..', 'data', 'self-awareness.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`\n✅ Self-awareness report saved to ${reportPath}`);
        return reportPath;
    }

    /**
     * Main execution - full self-awareness scan
     */
    async run() {
        console.log('╔════════════════════════════════════════════════════════════╗');
        console.log('║     AGENT POLARIS - SELF-AWARENESS MODULE                  ║');
        console.log('║     "Know thyself to improve thyself"                      ║');
        console.log('╚════════════════════════════════════════════════════════════╝');

        // Step 1: Scan entire codebase
        await this.scanEntireCodebase();
        
        // Step 2: Map connections
        this.mapConnections();
        
        // Step 3: Identify capabilities
        this.identifyCapabilities();
        
        // Step 4: Identify limitations
        this.identifyLimitations();
        
        // Step 5: Generate report
        const report = this.generateSelfReport();
        
        // Step 6: Save report
        await this.saveReport(report);

        // Print summary
        console.log('\n' + '═'.repeat(60));
        console.log('SELF-AWARENESS SUMMARY');
        console.log('═'.repeat(60));
        console.log(`📁 Files scanned: ${report.codebaseStats.totalFiles}`);
        console.log(`💪 Capabilities: ${report.capabilities.length}`);
        console.log(`⚠️ Limitations: ${report.limitations.length}`);
        console.log(`💡 Improvements: ${report.improvements.length}`);
        console.log(`❤️ Health: ${report.health.score}% (${report.health.status})`);
        console.log('═'.repeat(60));

        return report;
    }
}

// Export for use by other modules
module.exports = { AISelfAwareness };

// Run if called directly
if (require.main === module) {
    const awareness = new AISelfAwareness();
    awareness.run().catch(console.error);
}
