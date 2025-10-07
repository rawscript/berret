const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');

async function voidCommand(packageName) {
  console.log(chalk.blue('🗑️  Berret Void - Optimizing packages...'));

  if (packageName) {
    await optimizeSpecificPackage(packageName);
  } else {
    await optimizeAllPackages();
  }
}

async function optimizeSpecificPackage(packageName) {
  const spinner = ora(`Optimizing ${packageName}`).start();
  
  try {
    const packagePath = path.join('node_modules', packageName);
    
    if (!await fs.pathExists(packagePath)) {
      spinner.fail(`Package ${packageName} not found`);
      return;
    }

    const optimized = await removeUnnecessaryFiles(packagePath, packageName);
    
    if (optimized.removed > 0) {
      spinner.succeed(`${chalk.green(packageName)} optimized - removed ${optimized.removed} unnecessary files (${optimized.sizeReduced})`);
    } else {
      spinner.succeed(`${chalk.yellow(packageName)} already optimized`);
    }
  } catch (error) {
    spinner.fail(`Failed to optimize ${packageName}: ${error.message}`);
  }
}

async function optimizeAllPackages() {
  const nodeModulesPath = 'node_modules';
  
  if (!await fs.pathExists(nodeModulesPath)) {
    console.log(chalk.yellow('No node_modules directory found'));
    return;
  }

  const packages = await fs.readdir(nodeModulesPath);
  const realPackages = packages.filter(pkg => !pkg.startsWith('.') && !pkg.startsWith('@'));
  
  console.log(chalk.gray(`Found ${realPackages.length} packages to optimize\n`));

  let totalRemoved = 0;
  let totalSizeReduced = 0;

  for (const packageName of realPackages) {
    const spinner = ora(`Optimizing ${packageName}`).start();
    
    try {
      const packagePath = path.join(nodeModulesPath, packageName);
      const optimized = await removeUnnecessaryFiles(packagePath, packageName);
      
      totalRemoved += optimized.removed;
      totalSizeReduced += optimized.sizeReducedBytes;
      
      if (optimized.removed > 0) {
        spinner.succeed(`${chalk.green(packageName)} - removed ${optimized.removed} files`);
      } else {
        spinner.succeed(`${chalk.gray(packageName)} - already clean`);
      }
    } catch (error) {
      spinner.fail(`${packageName} - ${error.message}`);
    }
  }

  console.log(chalk.green(`\n✨ Optimization complete!`));
  console.log(chalk.gray(`Total files removed: ${totalRemoved}`));
  console.log(chalk.gray(`Total size reduced: ${formatBytes(totalSizeReduced)}`));
}

async function removeUnnecessaryFiles(packagePath, packageName) {
  const unnecessaryPatterns = [
    'test', 'tests', '__tests__',
    'spec', 'specs', '__specs__',
    'example', 'examples',
    'demo', 'demos',
    'doc', 'docs',
    'benchmark', 'benchmarks',
    '.github', '.gitlab',
    'coverage',
    '*.md', '*.txt',
    'CHANGELOG*', 'HISTORY*',
    'LICENSE*', 'LICENCE*',
    '.eslint*', '.prettier*',
    'tsconfig.json', 'jest.config.*',
    '.travis.yml', '.circleci',
    'Gruntfile.*', 'gulpfile.*'
  ];

  let removed = 0;
  let sizeReducedBytes = 0;

  // Read package.json to understand what files are actually needed
  const packageJsonPath = path.join(packagePath, 'package.json');
  let packageJson = {};
  
  try {
    packageJson = await fs.readJson(packageJsonPath);
  } catch (error) {
    // Continue without package.json info
  }

  // Keep essential files
  const essentialFiles = new Set([
    packageJson.main,
    packageJson.module,
    packageJson.browser,
    ...(packageJson.files || []),
    'package.json',
    'index.js',
    'index.ts',
    'lib',
    'dist',
    'build'
  ].filter(Boolean));

  const allFiles = await getAllFiles(packagePath);

  for (const filePath of allFiles) {
    const relativePath = path.relative(packagePath, filePath);
    const fileName = path.basename(filePath);
    const dirName = path.dirname(relativePath);

    // Check if file matches unnecessary patterns
    const isUnnecessary = unnecessaryPatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(fileName) || regex.test(relativePath);
      }
      return fileName === pattern || dirName.includes(pattern) || relativePath.includes(pattern);
    });

    // Don't remove essential files
    const isEssential = essentialFiles.has(relativePath) || 
                       essentialFiles.has(fileName) ||
                       essentialFiles.has(dirName);

    if (isUnnecessary && !isEssential) {
      try {
        const stats = await fs.stat(filePath);
        sizeReducedBytes += stats.size;
        await fs.remove(filePath);
        removed++;
      } catch (error) {
        // Continue if file can't be removed
      }
    }
  }

  return {
    removed,
    sizeReduced: formatBytes(sizeReducedBytes),
    sizeReducedBytes
  };
}

async function getAllFiles(dir) {
  const files = [];
  
  async function traverse(currentDir) {
    const items = await fs.readdir(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stats = await fs.stat(fullPath);
      
      if (stats.isDirectory()) {
        await traverse(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  await traverse(dir);
  return files;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = { voidCommand };