const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const glob = require('fast-glob');

class ProjectStructure {
  constructor() {
    this.languageExtensions = {
      'JavaScript': ['.js', '.jsx', '.mjs', '.cjs'],
      'TypeScript': ['.ts', '.tsx', '.d.ts'],
      'Python': ['.py', '.pyx', '.pyi'],
      'Java': ['.java', '.class', '.jar'],
      'C++': ['.cpp', '.cc', '.cxx', '.c++', '.hpp', '.h++'],
      'C': ['.c', '.h'],
      'C#': ['.cs', '.csx'],
      'Go': ['.go'],
      'Rust': ['.rs'],
      'PHP': ['.php', '.phtml'],
      'Ruby': ['.rb', '.rbw'],
      'Swift': ['.swift'],
      'Kotlin': ['.kt', '.kts'],
      'Dart': ['.dart'],
      'HTML': ['.html', '.htm', '.xhtml'],
      'CSS': ['.css', '.scss', '.sass', '.less'],
      'Vue': ['.vue'],
      'Svelte': ['.svelte'],
      'JSON': ['.json', '.jsonc'],
      'YAML': ['.yml', '.yaml'],
      'XML': ['.xml', '.xsd', '.xsl'],
      'Markdown': ['.md', '.markdown', '.mdx'],
      'Shell': ['.sh', '.bash', '.zsh', '.fish'],
      'PowerShell': ['.ps1', '.psm1', '.psd1'],
      'SQL': ['.sql', '.mysql', '.pgsql'],
      'Docker': ['Dockerfile', '.dockerignore'],
      'Config': ['.env', '.ini', '.conf', '.config', '.toml']
    };

    this.ignorePatterns = [
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      'dist',
      'build',
      'coverage',
      '.nyc_output',
      '.cache',
      'tmp',
      'temp',
      '.DS_Store',
      'Thumbs.db'
    ];

    this.languageStats = {};
    this.totalFiles = 0;
  }

  async structCommand() {
    console.log(chalk.blue('🏗️  Berret Project Structure Analysis\n'));

    const projectRoot = process.cwd();
    const projectName = path.basename(projectRoot);

    console.log(chalk.cyan(`📁 Project: ${chalk.yellow(projectName)}`));
    console.log(chalk.gray(`📍 Path: ${projectRoot}\n`));

    // Analyze project structure
    await this.analyzeProject(projectRoot);

    // Display the tree structure
    console.log(chalk.blue('📂 Project Structure:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    await this.displayTree(projectRoot, '', true);

    // Display language statistics
    this.displayLanguageStats();

    // Display project insights
    await this.displayProjectInsights(projectRoot);
  }

  async analyzeProject(projectRoot) {
    try {
      // Get all files except ignored ones
      const files = await glob('**/*', {
        cwd: projectRoot,
        ignore: this.ignorePatterns.map(pattern => `**/${pattern}/**`),
        dot: false,
        onlyFiles: true
      });

      // Analyze language distribution
      for (const file of files) {
        this.totalFiles++;
        const ext = path.extname(file).toLowerCase();
        const basename = path.basename(file);

        // Find matching language
        for (const [language, extensions] of Object.entries(this.languageExtensions)) {
          if (extensions.includes(ext) || extensions.includes(basename)) {
            this.languageStats[language] = (this.languageStats[language] || 0) + 1;
            break;
          }
        }
      }
    } catch (error) {
      console.log(chalk.red('Error analyzing project:', error.message));
    }
  }

  async displayTree(dirPath, prefix = '', isLast = true) {
    try {
      const items = await fs.readdir(dirPath);
      const filteredItems = items.filter(item => !item.startsWith('.') || item === '.env' || item === '.gitignore');
      
      // Sort: directories first, then files
      const sortedItems = [];
      const dirs = [];
      const files = [];

      for (const item of filteredItems) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
        
        if (stats.isDirectory()) {
          dirs.push(item);
        } else {
          files.push(item);
        }
      }

      const allItems = [...dirs.sort(), ...files.sort()];

      for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const itemPath = path.join(dirPath, item);
        const isLastItem = i === allItems.length - 1;
        const stats = await fs.stat(itemPath);

        // Create tree symbols
        const connector = isLastItem ? '└── ' : '├── ';
        const newPrefix = prefix + (isLastItem ? '    ' : '│   ');

        if (stats.isDirectory()) {
          if (item === 'node_modules') {
            // Special handling for node_modules
            console.log(prefix + connector + chalk.red(`📦 ${item}`));
          } else if (this.ignorePatterns.includes(item)) {
            // Skip ignored directories
            continue;
          } else {
            console.log(prefix + connector + chalk.blue(`📁 ${item}`));
            
            // Recursively display subdirectory (with depth limit)
            const currentDepth = prefix.length / 4;
            if (currentDepth < 4) { // Limit depth to avoid too much output
              await this.displayTree(itemPath, newPrefix, isLastItem);
            }
          }
        } else {
          // Display file with appropriate icon and color
          const fileDisplay = this.formatFile(item);
          console.log(prefix + connector + fileDisplay);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  formatFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename);

    // Special files
    if (basename === 'package.json') return chalk.green(`📦 ${filename}`);
    if (basename === 'README.md') return chalk.cyan(`📖 ${filename}`);
    if (basename === '.gitignore') return chalk.gray(`🚫 ${filename}`);
    if (basename === '.env') return chalk.yellow(`🔐 ${filename}`);
    if (basename === 'Dockerfile') return chalk.blue(`🐳 ${filename}`);

    // Language-based coloring
    if (['.js', '.jsx', '.mjs'].includes(ext)) return chalk.yellow(`📄 ${filename}`);
    if (['.ts', '.tsx'].includes(ext)) return chalk.blue(`📄 ${filename}`);
    if (['.py'].includes(ext)) return chalk.green(`🐍 ${filename}`);
    if (['.java'].includes(ext)) return chalk.red(`☕ ${filename}`);
    if (['.cpp', '.c', '.h'].includes(ext)) return chalk.magenta(`⚙️ ${filename}`);
    if (['.html', '.htm'].includes(ext)) return chalk.red(`🌐 ${filename}`);
    if (['.css', '.scss', '.sass'].includes(ext)) return chalk.blue(`🎨 ${filename}`);
    if (['.json'].includes(ext)) return chalk.yellow(`📋 ${filename}`);
    if (['.md', '.markdown'].includes(ext)) return chalk.cyan(`📝 ${filename}`);
    if (['.yml', '.yaml'].includes(ext)) return chalk.magenta(`⚙️ ${filename}`);

    // Default
    return chalk.white(`📄 ${filename}`);
  }

  displayLanguageStats() {
    console.log('\n' + chalk.blue('📊 Language Distribution:'));
    console.log(chalk.gray('─'.repeat(50)));

    if (Object.keys(this.languageStats).length === 0) {
      console.log(chalk.gray('No recognized programming languages found.'));
      return;
    }

    // Sort languages by file count
    const sortedLanguages = Object.entries(this.languageStats)
      .sort(([,a], [,b]) => b - a);

    const maxCount = Math.max(...Object.values(this.languageStats));

    for (const [language, count] of sortedLanguages) {
      const percentage = ((count / this.totalFiles) * 100).toFixed(1);
      const barLength = Math.round((count / maxCount) * 30);
      const bar = '█'.repeat(barLength) + '░'.repeat(30 - barLength);
      
      const languageColor = this.getLanguageColor(language);
      console.log(
        `${languageColor(language.padEnd(12))} ${chalk.cyan(bar)} ${chalk.yellow(percentage.padStart(5))}% ${chalk.gray(`(${count} files)`)}`
      );
    }

    console.log(chalk.gray(`\nTotal files analyzed: ${this.totalFiles}`));
  }

  getLanguageColor(language) {
    const colors = {
      'JavaScript': chalk.yellow,
      'TypeScript': chalk.blue,
      'Python': chalk.green,
      'Java': chalk.red,
      'C++': chalk.magenta,
      'C': chalk.magenta,
      'HTML': chalk.red,
      'CSS': chalk.blue,
      'JSON': chalk.yellow,
      'Markdown': chalk.cyan
    };
    return colors[language] || chalk.white;
  }

  async displayProjectInsights(projectRoot) {
    console.log('\n' + chalk.blue('💡 Project Insights:'));
    console.log(chalk.gray('─'.repeat(50)));

    try {
      // Check for package.json
      const packageJsonPath = path.join(projectRoot, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        
        console.log(chalk.green('✅ Node.js project detected'));
        
        if (packageJson.scripts) {
          const scriptCount = Object.keys(packageJson.scripts).length;
          console.log(chalk.cyan(`📜 ${scriptCount} npm scripts available`));
        }

        const depCount = Object.keys(packageJson.dependencies || {}).length;
        const devDepCount = Object.keys(packageJson.devDependencies || {}).length;
        console.log(chalk.yellow(`📦 ${depCount} dependencies, ${devDepCount} dev dependencies`));

        // Detect framework/library
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        if (deps.react) console.log(chalk.blue('⚛️  React project'));
        if (deps.vue) console.log(chalk.green('💚 Vue.js project'));
        if (deps.angular || deps['@angular/core']) console.log(chalk.red('🅰️  Angular project'));
        if (deps.express) console.log(chalk.gray('🚀 Express.js backend'));
        if (deps.typescript) console.log(chalk.blue('📘 TypeScript enabled'));
      }

      // Check for other project types
      if (await fs.pathExists(path.join(projectRoot, 'requirements.txt'))) {
        console.log(chalk.green('🐍 Python project detected'));
      }

      if (await fs.pathExists(path.join(projectRoot, 'pom.xml'))) {
        console.log(chalk.red('☕ Maven Java project detected'));
      }

      if (await fs.pathExists(path.join(projectRoot, 'Cargo.toml'))) {
        console.log(chalk.orange('🦀 Rust project detected'));
      }

      if (await fs.pathExists(path.join(projectRoot, 'go.mod'))) {
        console.log(chalk.cyan('🐹 Go project detected'));
      }

    } catch (error) {
      console.log(chalk.gray('Could not analyze project insights'));
    }
  }
}

async function structCommand() {
  const analyzer = new ProjectStructure();
  await analyzer.structCommand();
}

module.exports = { structCommand };