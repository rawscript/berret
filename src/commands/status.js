const chalk = require('chalk');
const ora = require('ora');
const chokidar = require('chokidar');
const fs = require('fs-extra');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');
const cliProgress = require('cli-progress');
const glob = require('fast-glob');

class NpmMonitor {
  constructor(isUniversal = false) {
    this.activeInstalls = new Map();
    this.dependencyChains = new Map();
    this.installationProgress = new Map();
    this.isUniversal = isUniversal;
    this.monitoredProjects = new Set();
    this.progressBars = new Map();
    this.multibar = new cliProgress.MultiBar({
      clearOnComplete: false,
      hideCursor: true,
      format: ' {bar} | {percentage}% | {package} | {status} | {eta_formatted}'
    }, cliProgress.Presets.shades_classic);
  }

  async statusCommand(options = {}) {
    const isUniversal = options.uni || false;
    const isQuick = options.quick || false;
    this.isUniversal = isUniversal;

    if (isUniversal) {
      if (isQuick) {
        console.log(chalk.blue('🌍 Berret Universal Monitor Started (Quick Mode)'));
        console.log(chalk.gray('Starting with current directory, discovering others in background...\n'));
        await this.startQuickUniversalMonitoring();
      } else {
        console.log(chalk.blue('🌍 Berret Universal Monitor Started'));
        console.log(chalk.gray('Monitoring npm activity across entire system...\n'));
        await this.startUniversalMonitoring();
      }
    } else {
      console.log(chalk.blue('🔍 Berret Status Monitor Started'));
      console.log(chalk.gray('Watching for npm installations in current directory...\n'));
      await this.startLocalMonitoring();
    }

    // Keep the process alive
    process.on('SIGINT', () => {
      this.multibar.stop();
      console.log(chalk.yellow('\n👋 Berret monitor stopped'));
      process.exit(0);
    });
  }

  async startQuickUniversalMonitoring() {
    // Start monitoring current directory immediately
    if (await fs.pathExists('package.json')) {
      this.monitoredProjects.add(process.cwd());
      console.log(chalk.green(`📦 Monitoring current project: ${path.basename(process.cwd())}`));
      await this.watchProjectDirectoryWithProgress(process.cwd());
    }

    // Monitor global npm processes immediately
    this.monitorGlobalNpmProcesses();
    this.watchGlobalNodeModules();

    console.log(chalk.green('✨ Quick monitoring active! Discovering additional projects in background...\n'));

    // Discover other projects in background (non-blocking)
    setTimeout(async () => {
      console.log(chalk.gray('🔍 Background discovery starting...'));
      await this.fastFindAndMonitorProjects();
      console.log(chalk.gray(`📦 Background discovery complete - now monitoring ${this.monitoredProjects.size} projects total`));
    }, 2000); // Start background discovery after 2 seconds

    // Periodic background scanning
    setInterval(() => {
      this.fastFindAndMonitorProjects();
    }, 180000); // Every 3 minutes
  }

  async startLocalMonitoring() {
    // Analyze current package.json for dependency chains
    await this.analyzeDependencyChains();
    
    // Watch for package.json changes
    this.watchPackageJson();
    
    // Watch for node_modules changes with progress tracking
    this.watchNodeModulesWithProgress();
    
    // Monitor running npm processes with detailed info
    this.monitorNpmProcessesDetailed();
  }

  async startUniversalMonitoring() {
    const spinner = ora('🔄 Fast scanning for Node.js projects...').start();
    
    // Start monitoring immediately for current directory
    if (await fs.pathExists('package.json')) {
      this.monitoredProjects.add(process.cwd());
      console.log(chalk.green(`📦 Monitoring current project: ${path.basename(process.cwd())}`));
      await this.watchProjectDirectoryWithProgress(process.cwd());
    }
    
    spinner.text = '🔍 Discovering additional projects...';
    
    // Use concurrent discovery for faster scanning
    await this.fastFindAndMonitorProjects();
    
    spinner.succeed(`📦 Monitoring ${this.monitoredProjects.size} projects total`);
    
    // Monitor global npm processes
    this.monitorGlobalNpmProcesses();
    
    // Monitor global npm directory
    this.watchGlobalNodeModules();
    
    console.log(chalk.gray('✨ Universal monitoring active - install packages anywhere to see them here!\n'));
    
    // Periodically scan for new projects (less frequent due to fast initial scan)
    setInterval(() => {
      this.fastFindAndMonitorProjects();
    }, 120000); // Every 2 minutes (reduced frequency)
  }

  async fastFindAndMonitorProjects() {
    const safePaths = [
      path.join(os.homedir(), 'Documents'),
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Projects'),
      path.join(os.homedir(), 'Development'),
      path.join(os.homedir(), 'dev'),
      process.cwd()
    ];

    // Quick accessibility check with timeout
    const accessiblePaths = await Promise.allSettled(
      safePaths.map(async (searchPath) => {
        try {
          if (await fs.pathExists(searchPath)) {
            // Quick test with timeout
            await Promise.race([
              fs.readdir(searchPath),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
            ]);
            return searchPath;
          }
        } catch (error) {
          // Skip inaccessible paths
        }
        return null;
      })
    );

    const validPaths = accessiblePaths
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value);

    if (validPaths.length === 0) {
      console.log(chalk.yellow('⚠️  No accessible directories found for scanning'));
      return;
    }

    console.log(chalk.gray(`🔍 Scanning ${validPaths.length} directories...`));

    // Scan paths concurrently with reduced depth for speed
    const scanPromises = validPaths.map(async (searchPath) => {
      try {
        const packageJsonFiles = await glob('**/package.json', {
          cwd: searchPath,
          ignore: [
            '**/node_modules/**', 
            '**/.git/**', 
            '**/dist/**', 
            '**/build/**',
            '**/coverage/**',
            '**/.cache/**',
            '**/tmp/**',
            '**/temp/**',
            // Windows system directories
            '**/AppData/**',
            '**/Application Data/**',
            '**/ProgramData/**',
            '**/System Volume Information/**',
            // Common restricted directories
            '**/$RECYCLE.BIN/**',
            '**/Windows/**',
            '**/Program Files/**',
            '**/Program Files (x86)/**',
            // Speed optimizations - skip deep nested dirs
            '**/vendor/**',
            '**/venv/**',
            '**/env/**',
            '**/.venv/**'
          ],
          absolute: true,
          maxDepth: 3, // Reduced from 4 to 3 for speed
          suppressErrors: true,
          stats: false, // Don't collect file stats for speed
          followSymbolicLinks: false // Don't follow symlinks for speed
        });
        
        return packageJsonFiles;
      } catch (error) {
        console.log(chalk.gray(`⚠️  Skipped ${path.basename(searchPath)}: ${error.message}`));
        return [];
      }
    });

    const scanResults = await Promise.allSettled(scanPromises);
    const allPackageJsonFiles = scanResults
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value);

    console.log(chalk.gray(`📦 Found ${allPackageJsonFiles.length} potential projects`));

    // Process projects in batches for better performance
    const batchSize = 5;
    for (let i = 0; i < allPackageJsonFiles.length; i += batchSize) {
      const batch = allPackageJsonFiles.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (packageJsonPath) => {
        try {
          const projectPath = path.dirname(packageJsonPath);
          
          if (!this.monitoredProjects.has(projectPath)) {
            this.monitoredProjects.add(projectPath);
            console.log(chalk.green(`📦 Found project: ${path.basename(projectPath)}`));
            await this.watchProjectDirectoryWithProgress(projectPath);
          }
        } catch (error) {
          // Skip projects we can't access
        }
      });

      await Promise.allSettled(batchPromises);
    }
  }

  async analyzeDependencyChains() {
    try {
      const packageJsonPath = 'package.json';
      if (!await fs.pathExists(packageJsonPath)) return;

      const packageJson = await fs.readJson(packageJsonPath);
      const allDeps = { 
        ...packageJson.dependencies, 
        ...packageJson.devDependencies 
      };

      // Analyze each dependency to understand the chain
      for (const [depName, version] of Object.entries(allDeps)) {
        this.dependencyChains.set(depName, {
          type: 'user-requested',
          parent: null,
          version: version,
          reason: 'Direct dependency in package.json'
        });
      }
    } catch (error) {
      // Ignore errors
    }
  }

  async analyzeDependencyChain(packageName, projectPath = process.cwd()) {
    try {
      // Check if it's a direct dependency
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = await fs.readJson(packageJsonPath);
      const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (allDeps[packageName]) {
        return {
          type: 'user-requested',
          parent: null,
          reason: `Direct dependency in package.json`
        };
      }

      // Check package-lock.json for dependency chain
      const lockPath = path.join(projectPath, 'package-lock.json');
      if (await fs.pathExists(lockPath)) {
        const lockJson = await fs.readJson(lockPath);
        const packageInfo = this.findPackageInLock(packageName, lockJson);
        
        if (packageInfo) {
          return {
            type: 'dependency',
            parent: packageInfo.parent,
            reason: `Dependency of ${packageInfo.parent || 'unknown package'}`
          };
        }
      }

      return {
        type: 'unknown',
        parent: null,
        reason: 'Installation source unknown'
      };
    } catch (error) {
      return {
        type: 'unknown',
        parent: null,
        reason: 'Could not analyze dependency chain'
      };
    }
  }

  findPackageInLock(packageName, lockJson, parent = null) {
    if (lockJson.packages) {
      for (const [pkgPath, pkgInfo] of Object.entries(lockJson.packages)) {
        if (pkgPath.endsWith(`/node_modules/${packageName}`)) {
          const parentPath = pkgPath.replace(`/node_modules/${packageName}`, '');
          const parentName = parentPath.split('/').pop() || parent;
          return { parent: parentName };
        }
      }
    }

    if (lockJson.dependencies) {
      for (const [depName, depInfo] of Object.entries(lockJson.dependencies)) {
        if (depName === packageName) {
          return { parent };
        }
        if (depInfo.dependencies) {
          const result = this.findPackageInLock(packageName, { dependencies: depInfo.dependencies }, depName);
          if (result) return result;
        }
      }
    }

    return null;
  }

  watchNodeModulesWithProgress() {
    if (!fs.existsSync('node_modules')) return;

    const watcher = chokidar.watch('node_modules', { 
      ignoreInitial: true,
      depth: 1
    });

    watcher.on('addDir', async (dirPath) => {
      const packageName = path.basename(dirPath);
      if (!packageName.startsWith('.')) {
        const chainInfo = await this.analyzeDependencyChain(packageName);
        this.trackInstallationWithProgress(packageName, 'LOCAL', chainInfo);
      }
    });
  }

  async watchProjectDirectoryWithProgress(projectPath) {
    try {
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      
      if (fs.existsSync(nodeModulesPath)) {
        const watcher = chokidar.watch(nodeModulesPath, { 
          ignoreInitial: true,
          depth: 1,
          ignorePermissionErrors: true // Ignore permission errors
        });

        watcher.on('addDir', async (dirPath) => {
          try {
            const packageName = path.basename(dirPath);
            const projectName = path.basename(projectPath);
            if (!packageName.startsWith('.')) {
              const chainInfo = await this.analyzeDependencyChain(packageName, projectPath);
              this.trackInstallationWithProgress(packageName, projectName, chainInfo);
            }
          } catch (error) {
            // Skip individual package monitoring errors
          }
        });

        watcher.on('error', (error) => {
          // Silently handle watcher errors
          console.log(chalk.gray(`⚠️  Monitoring error for ${path.basename(projectPath)}: ${error.message}`));
        });
      }

      // Watch package.json changes
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageWatcher = chokidar.watch(packageJsonPath, { 
          ignoreInitial: true,
          ignorePermissionErrors: true
        });
        
        packageWatcher.on('change', async () => {
          try {
            const projectName = path.basename(projectPath);
            console.log(chalk.green(`📦 [${projectName}] package.json updated`));
            // Re-analyze dependency chains
            await this.analyzeDependencyChains();
          } catch (error) {
            // Skip package.json monitoring errors
          }
        });

        packageWatcher.on('error', (error) => {
          // Silently handle watcher errors
        });
      }
    } catch (error) {
      // Skip entire project if we can't monitor it
      console.log(chalk.gray(`⚠️  Cannot monitor project: ${path.basename(projectPath)}`));
    }
  }

  trackInstallationWithProgress(packageName, projectName, chainInfo) {
    const key = `${projectName}:${packageName}`;
    if (this.activeInstalls.has(key)) return;

    // Create progress bar
    const progressBar = this.multibar.create(100, 0, {
      package: `${packageName}`,
      status: this.getStatusText(chainInfo),
      eta_formatted: 'calculating...'
    });

    this.progressBars.set(key, progressBar);
    this.activeInstalls.set(key, { 
      startTime: Date.now(), 
      projectName,
      chainInfo,
      progressBar
    });

    // Display dependency chain info
    const chainText = this.formatChainInfo(packageName, chainInfo, projectName);
    console.log(chainText);

    // Start progress simulation and monitoring
    this.simulateInstallProgress(key, packageName, projectName);
    this.checkInstallationCompleteWithProgress(key, packageName, projectName);
  }

  formatChainInfo(packageName, chainInfo, projectName) {
    const prefix = projectName === 'GLOBAL' ? '🌍' : projectName === 'LOCAL' ? '📥' : `📥 [${projectName}]`;
    
    if (chainInfo.type === 'user-requested') {
      return chalk.cyan(`${prefix} Installing: ${chalk.yellow(packageName)} ${chalk.gray('(user requested)')}`);
    } else if (chainInfo.type === 'dependency') {
      return chalk.cyan(`${prefix} Installing: ${chalk.yellow(packageName)} ${chalk.gray(`(dependency of ${chainInfo.parent})`)}`);
    } else {
      return chalk.cyan(`${prefix} Installing: ${chalk.yellow(packageName)} ${chalk.gray('(analyzing...)')}`);
    }
  }

  getStatusText(chainInfo) {
    if (chainInfo.type === 'user-requested') {
      return 'User Package';
    } else if (chainInfo.type === 'dependency') {
      return `Dep of ${chainInfo.parent}`;
    } else {
      return 'Installing...';
    }
  }

  simulateInstallProgress(key, packageName, projectName) {
    const install = this.activeInstalls.get(key);
    if (!install) return;

    let progress = 0;
    const progressInterval = setInterval(() => {
      if (!this.activeInstalls.has(key)) {
        clearInterval(progressInterval);
        return;
      }

      // Simulate realistic installation progress
      const elapsed = Date.now() - install.startTime;
      const estimatedDuration = this.estimateInstallDuration(packageName);
      
      progress = Math.min(95, (elapsed / estimatedDuration) * 100);
      
      install.progressBar.update(progress, {
        package: packageName,
        status: install.chainInfo ? this.getStatusText(install.chainInfo) : 'Installing...',
        eta_formatted: this.formatETA(estimatedDuration - elapsed)
      });
    }, 200);

    // Store interval for cleanup
    install.progressInterval = progressInterval;
  }

  estimateInstallDuration(packageName) {
    // Estimate based on package name patterns
    const largePackages = ['react', 'angular', 'vue', 'webpack', 'typescript', 'babel'];
    const mediumPackages = ['lodash', 'moment', 'axios', 'express'];
    
    if (largePackages.some(pkg => packageName.includes(pkg))) {
      return 8000; // 8 seconds
    } else if (mediumPackages.some(pkg => packageName.includes(pkg))) {
      return 4000; // 4 seconds
    } else {
      return 2000; // 2 seconds
    }
  }

  formatETA(milliseconds) {
    if (milliseconds <= 0) return '0s';
    const seconds = Math.ceil(milliseconds / 1000);
    return `${seconds}s`;
  }

  checkInstallationCompleteWithProgress(key, packageName, projectName) {
    const checkComplete = () => {
      if (!this.activeInstalls.has(key)) return;

      let packagePath;
      
      if (projectName === 'GLOBAL') {
        packagePath = path.join(this.getGlobalNodeModulesPath(), packageName, 'package.json');
      } else if (projectName === 'LOCAL') {
        packagePath = path.join('node_modules', packageName, 'package.json');
      } else {
        // Find the project path
        for (const monitoredPath of this.monitoredProjects) {
          if (path.basename(monitoredPath) === projectName) {
            packagePath = path.join(monitoredPath, 'node_modules', packageName, 'package.json');
            break;
          }
        }
      }
      
      if (packagePath && fs.existsSync(packagePath)) {
        const install = this.activeInstalls.get(key);
        if (install) {
          const duration = ((Date.now() - install.startTime) / 1000).toFixed(1);
          
          // Complete the progress bar
          install.progressBar.update(100, {
            package: packageName,
            status: 'Complete!',
            eta_formatted: '0s'
          });

          // Clean up
          if (install.progressInterval) {
            clearInterval(install.progressInterval);
          }
          
          setTimeout(() => {
            this.multibar.remove(install.progressBar);
            const chainText = install.chainInfo ? 
              (install.chainInfo.type === 'user-requested' ? ' (user requested)' : ` (dep of ${install.chainInfo.parent})`) : '';
            console.log(chalk.green(`✅ [${projectName}] ${packageName} installed (${duration}s)${chainText}`));
          }, 1000);

          this.activeInstalls.delete(key);
          this.progressBars.delete(key);
        }
      } else {
        // Check again in 300ms
        setTimeout(checkComplete, 300);
      }
    };

    setTimeout(checkComplete, 500);
  }

  // ... (keeping existing methods for global monitoring)
  watchGlobalNodeModules() {
    const globalNodeModules = this.getGlobalNodeModulesPath();
    
    if (fs.existsSync(globalNodeModules)) {
      const watcher = chokidar.watch(globalNodeModules, { 
        ignoreInitial: true,
        depth: 1
      });

      watcher.on('addDir', async (dirPath) => {
        const packageName = path.basename(dirPath);
        if (!packageName.startsWith('.')) {
          const chainInfo = { type: 'user-requested', parent: null, reason: 'Global installation' };
          this.trackInstallationWithProgress(packageName, 'GLOBAL', chainInfo);
        }
      });
    }
  }

  getGlobalNodeModulesPath() {
    if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || '', 'npm', 'node_modules');
    } else {
      return '/usr/local/lib/node_modules';
    }
  }

  watchPackageJson() {
    const watcher = chokidar.watch('package.json', { ignoreInitial: true });
    
    watcher.on('change', async () => {
      console.log(chalk.green('📦 package.json updated'));
      await this.analyzeDependencyChains();
    });
  }

  monitorNpmProcessesDetailed() {
    // Enhanced process monitoring with more details
    this.monitorProcesses('npm');
  }

  monitorGlobalNpmProcesses() {
    this.monitorProcesses('npm', true);
  }

  monitorProcesses(processName, isGlobal = false) {
    const interval = setInterval(() => {
      if (process.platform === 'win32') {
        exec(`tasklist /FI "IMAGENAME eq ${processName}.exe" /FO CSV`, (error, stdout) => {
          if (!error && stdout.includes(processName)) {
            // npm process detected - could enhance this further
          }
        });
      } else {
        exec(`pgrep -f ${processName}`, (error, stdout) => {
          if (!error && stdout.trim()) {
            // npm process detected
          }
        });
      }
    }, 2000);

    process.on('exit', () => clearInterval(interval));
  }
}

async function statusCommand(options) {
  const monitor = new NpmMonitor();
  await monitor.statusCommand(options);
}

module.exports = { statusCommand };