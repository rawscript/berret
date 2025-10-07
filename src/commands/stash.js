const chalk = require('chalk');
const ora = require('ora');
const { spawn } = require('child_process');
const fs = require('fs-extra');
const path = require('path');

async function stashCommand() {
  console.log(chalk.blue('🧹 Berret Stash - Clearing caches...'));

  const tasks = [
    { name: 'npm cache', command: 'npm', args: ['cache', 'clean', '--force'] },
    { name: 'berret cache', action: clearBerretCache }
  ];

  for (const task of tasks) {
    const spinner = ora(`Clearing ${task.name}`).start();
    
    try {
      if (task.command) {
        await runCommand(task.command, task.args);
      } else if (task.action) {
        await task.action();
      }
      
      spinner.succeed(`${chalk.green(task.name)} cleared`);
    } catch (error) {
      spinner.fail(`Failed to clear ${task.name}: ${error.message}`);
    }
  }

  console.log(chalk.green('✨ All caches cleared successfully!'));
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: 'pipe' });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });
    
    process.on('error', reject);
  });
}

async function clearBerretCache() {
  const cacheDir = path.join(process.env.HOME || process.env.USERPROFILE, '.berret-cache');
  
  if (await fs.pathExists(cacheDir)) {
    await fs.remove(cacheDir);
  }
  
  // Clear any temporary files
  const tempDir = path.join(process.cwd(), '.berret-temp');
  if (await fs.pathExists(tempDir)) {
    await fs.remove(tempDir);
  }
}

module.exports = { stashCommand };