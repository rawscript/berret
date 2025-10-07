# Berret 🎯

Smart npm package monitor and optimizer that helps you track installations and keep your node_modules lean.

## Installation

```bash
npm install -g berret
```

## Commands

### `berret status`
Monitor live npm package installations and progress in real-time.

```bash
# Monitor current directory only
berret status

# Monitor entire system (universal mode)
berret status --uni
```

Features:
- 🔍 Watches for package.json changes
- 📦 Tracks new package installations with **real-time progress bars**
- ⏱️ Shows installation progress percentage and ETA
- 📥 Real-time monitoring of node_modules changes
- 🔗 **Dependency chain analysis**: Shows if package is user-requested or dependency of another package
- 🌍 **Universal mode**: Monitor all npm activity across your entire system
- 🌍 **Global installs**: Track `npm install -g` packages
- 🌍 **Multi-project**: Monitor multiple Node.js projects simultaneously
- ⚡ **Fast concurrent discovery**: Uses fast-glob for rapid project scanning
- 📊 **Progress tracking**: Visual progress bars with estimated completion time

### `berret stash`
Clear npm cache and berret cache to free up space.

```bash
berret stash
```

Clears:
- npm cache (`npm cache clean --force`)
- berret internal cache
- temporary files

### `berret void [package]`
Remove unnecessary files from packages, keeping only core functionality.

```bash
# Optimize all packages
berret void

# Optimize specific package
berret void lodash
```

Removes:
- Test files and directories
- Documentation files
- Example code
- Build configuration files
- CI/CD configuration
- Benchmark files

### `berret struct`
Display beautiful project structure hierarchy with language analysis.

```bash
berret struct
```

Features:
- 🏗️ **Visual tree structure** of your entire project
- 📊 **Language distribution** with percentage breakdown
- 🎨 **Color-coded files** by type and language
- 🚫 **Smart filtering** - shows node_modules as single red folder
- 💡 **Project insights** - detects frameworks, dependencies, project type
- 📈 **File statistics** and project analysis

## Usage Examples

```bash
# Start monitoring npm installations (current directory)
berret status

# Monitor npm activity across entire system
berret status --uni

# Quick universal mode (faster startup)
berret status --uni --quick

# Clean all caches
berret stash

# Optimize all packages in node_modules
berret void

# Optimize specific package
berret void react

# Display project structure and language analysis
berret struct
```

## What gets removed by `berret void`

- `test/`, `tests/`, `__tests__/`
- `spec/`, `specs/`, `__specs__/`
- `example/`, `examples/`
- `demo/`, `demos/`
- `doc/`, `docs/`
- `benchmark/`, `benchmarks/`
- `.github/`, `.gitlab/`
- `coverage/`
- `*.md`, `*.txt` files
- `CHANGELOG*`, `HISTORY*`
- `LICENSE*`, `LICENCE*`
- Configuration files (`.eslint*`, `.prettier*`, `tsconfig.json`, etc.)

## License

MIT