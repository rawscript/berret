#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const { statusCommand } = require('../src/commands/status');
const { stashCommand } = require('../src/commands/stash');
const { voidCommand } = require('../src/commands/void');
const { structCommand } = require('../src/commands/struct');

const program = new Command();

program
  .name('berret')
  .description('Smart npm package monitor and optimizer')
  .version('1.3.2');

program
  .command('status')
  .description('Monitor live npm package installations and progress')
  .option('--uni', 'Monitor npm activity across entire system (universal mode)')
  .option('--quick', 'Quick start mode - monitor current directory only initially')
  .action(statusCommand);

program
  .command('stash')
  .description('Clear npm cache and berret cache')
  .action(stashCommand);

program
  .command('void')
  .description('Remove unnecessary package segments, keeping only core dependencies')
  .argument('[package]', 'specific package to optimize')
  .action(voidCommand);

program
  .command('struct')
  .description('Display project structure hierarchy with language analysis')
  .action(structCommand);

program.parse();